import requests
import json
import logging
from string import Template
from models import Settings, db
from flask import current_app

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EvolutionClient:
    """
    Client for interacting with Evolution API for WhatsApp messaging
    Supports both v1.8.x and v2.x.x versions of the API
    """
    
    def __init__(self):
        """Initialize the Evolution API client"""
        self.settings = None
        self.settings_data = {}
    
    def load_settings(self):
        """Load settings from the database"""
        try:
            # Always get fresh settings from the database to avoid session issues
            with current_app.app_context():
                settings = Settings.query.first()
                
                if not settings:
                    logger.error("No settings found in the database")
                    return False
                
                # Store all needed settings in a local dictionary to avoid session issues
                self.settings_data = {
                    'evolution_enabled': settings.evolution_enabled,
                    'evolution_url': settings.evolution_url,
                    'evolution_api_key': settings.evolution_api_key,
                    'evolution_message_template': settings.evolution_message_template,
                    'evolution_version': settings.evolution_version,
                    'evolution_instance': settings.evolution_instance
                }
                
                self.settings = settings
                return True
        except Exception as e:
            logger.error(f"Error loading settings: {str(e)}")
            return False
    
    def is_configured(self):
        """Check if Evolution API is properly configured"""
        # Reload settings every time to ensure fresh data
        self.load_settings()
        
        if not self.settings_data:
            return False
        
        return (self.settings_data.get('evolution_enabled') and 
                self.settings_data.get('evolution_url') and 
                self.settings_data.get('evolution_api_key') and
                self.settings_data.get('evolution_instance') and
                self.settings_data.get('evolution_version'))
    
    def substitute_template_variables(self, template, student_data):
        """
        Replace template variables with actual student data
        
        Args:
            template (str): Message template with variables like [[name]], [[email]], etc.
            student_data (dict): Dictionary with student data
            
        Returns:
            str: Template with variables replaced by actual values
        """
        if not template:
            return ""
        
        # Convert the template to use $-based placeholders
        for var in ['name', 'first_name', 'email', 'password', 'link', 'curso', 'fast_link']:
            template = template.replace(f"[[{var}]]", f"${var}")
        
        # Extract first name if full name is provided
        if 'name' in student_data and 'first_name' not in student_data:
            try:
                student_data['first_name'] = student_data['name'].split()[0]
            except:
                student_data['first_name'] = student_data['name']
        
        # Create a Template object and substitute variables
        try:
            template_obj = Template(template)
            # Safe substitution to avoid KeyError for missing placeholders
            return template_obj.safe_substitute(student_data)
        except Exception as e:
            logger.error(f"Error substituting template variables: {str(e)}")
            return template
    
    def _whatsapp_format_phone(self, phone_input: str) -> dict:
        # Remover espaços e caracteres especiais
        cleaned = phone_input.replace(" ", "").replace("(", "").replace(")", "").replace("-", "")
        length = len(cleaned)
        ddx = cleaned[:2]
        ddi = cleaned[0]  # inicialmente
        
        if length >= 12:
            if cleaned[0] == '+':
                ddi = cleaned[:3]
                number = str(int(cleaned[3:]))
            elif ddx == '55':
                ddi = "+55"
                number = str(int(cleaned[2:]))
            else:
                ddi = "não informado"
                number = str(int(cleaned))
        else:
            ddi = "não informado"
            number = str(int(cleaned))
        # Extrair DDD e atualizar o phone
        if len(number) >= 2:
            ddd = number[:2]
            rest = number[2:]
        else:
            ddd = ""
            rest = number
        try:
            if int(ddd) > 28:
                phone_formatted = rest[-8:]
            else:
                phone_formatted = "9" + rest[-8:]
        except Exception:
            phone_formatted = rest[-8:]
        whatsapp_formatado = "+55" + ddd + phone_formatted
        return {"ddi": ddi, "ddd": ddd, "phone": phone_formatted, "whatsapp_formatado": whatsapp_formatado}
    
    def send_message(self, phone_number, student_data):
        """
        Send WhatsApp message to a student
        
        Args:
            phone_number (str): Student's phone number (international format, no + sign)
            student_data (dict): Dictionary with student data for template variables
            
        Returns:
            tuple: (success, message) where success is boolean and message is response or error
        """
        if not self.is_configured():
            return False, "Evolution API is not properly configured"
        
        # Validate phone number format
        normalized = self._normalize_phone_number(phone_number)
        if not normalized:
            return False, f"Invalid phone number format: {phone_number}"
        
        # Format phone number as specified
        formatted_data = self._whatsapp_format_phone(phone_number)
        phone = formatted_data["whatsapp_formatado"]
        
        # Get message template and substitute variables
        template = self.settings_data.get('evolution_message_template', '')
        message = self.substitute_template_variables(template, student_data)
        
        if not message.strip():
            return False, "Empty message after template substitution"
        
        # Determine which API version to use
        if self.settings_data.get('evolution_version') == '1.8.x':
            return self._send_message_v1(phone, message)
        else:  # Default to v2 if not explicitly set to v1
            return self._send_message_v2(phone, message)
    
    def _normalize_phone_number(self, phone_number):
        """
        Normalize phone number to ensure it's in the correct format
        
        Args:
            phone_number (str): Phone number to normalize
            
        Returns:
            str: Normalized phone number or None if invalid
        """
        # Remove any non-digit characters
        phone = ''.join(filter(str.isdigit, phone_number))
        
        # Basic validation - should be at least 10 digits
        if len(phone) < 10:
            logger.error(f"Phone number too short: {phone}")
            return None
        
        return phone
    
    def _send_message_v1(self, phone, message):
        """
        Send message using Evolution API v1.8.x format
        
        Args:
            phone (str): Phone number
            message (str): Message text
            
        Returns:
            tuple: (success, response/error_message)
        """
        try:
            url = f"{self.settings_data.get('evolution_url')}/message/sendText/{self.settings_data.get('evolution_instance')}"
            
            headers = {
                'Content-Type': 'application/json',
                'apikey': self.settings_data.get('evolution_api_key')
            }
            
            payload = {
                "number": phone,
                "options": {
                    "delay": 1200,
                    "presence": "composing", 
                    "linkPreview": False  # Set to False as requested
                },
                "textMessage": {
                    "text": message
                }
            }
            
            logger.info(f"Sending to Evolution API v1.8.x: URL={url}")
            response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
            
            if response.status_code == 200 or response.status_code == 201:
                try:
                    result = response.json()
                    logger.info("Message sent successfully to Evolution API v1.8.x")
                    return True, result
                except Exception as e:
                    return True, "Message sent successfully"
            else:
                try:
                    error_info = response.json()
                    logger.error(f"Evolution API v1.8.x error: {error_info}")
                    return False, f"API error: {error_info.get('message', str(response.status_code))}"
                except Exception as e:
                    logger.error(f"Evolution API v1.8.x error: {response.status_code}")
                    return False, f"API error: {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            logger.error("Connection error with Evolution API v1.8.x")
            return False, "Connection error: Unable to connect to Evolution API"
        except requests.exceptions.Timeout:
            logger.error("Timeout error with Evolution API v1.8.x")
            return False, "Timeout error: The request timed out"
        except Exception as e:
            logger.error(f"Error sending message via Evolution API v1: {str(e)}")
            return False, f"Error: {str(e)}"
    
    def _send_message_v2(self, phone, message):
        """
        Send message using Evolution API v2.x.x format
        
        Args:
            phone (str): Phone number
            message (str): Message text
            
        Returns:
            tuple: (success, response/error_message)
        """
        try:
            # For v2.x.x, the URL should be /message/sendText without instance in the URL path
            url = f"{self.settings_data.get('evolution_url')}/message/sendText"
            
            headers = {
                'Content-Type': 'application/json',
                'apikey': self.settings_data.get('evolution_api_key')
            }
            
            # Format for v2.x.x as requested
            payload = {
                "number": phone,
                "textMessage": {
                    "text": message
                }, 
                "options": {
                    "delay": 1200,
                    "presence": "composing"
                },
                "instance": self.settings_data.get('evolution_instance')
            }
            
            logger.info(f"Sending to Evolution API v2.x.x: URL={url}")
            response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
            
            if response.status_code == 200 or response.status_code == 201:
                try:
                    result = response.json()
                    logger.info("Message sent successfully to Evolution API v2.x.x")
                    return True, result
                except Exception as e:
                    return True, "Message sent successfully"
            else:
                try:
                    error_info = response.json()
                    logger.error(f"Evolution API v2.x.x error: {error_info}")
                    return False, f"API error: {error_info.get('message', str(response.status_code))}"
                except Exception as e:
                    logger.error(f"Evolution API v2.x.x error: {response.status_code}")
                    return False, f"API error: {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            logger.error("Connection error with Evolution API v2.x.x")
            return False, "Connection error: Unable to connect to Evolution API"
        except requests.exceptions.Timeout:
            logger.error("Timeout error with Evolution API v2.x.x") 
            return False, "Timeout error: The request timed out"
        except Exception as e:
            logger.error(f"Error sending message via Evolution API v2: {str(e)}")
            return False, f"Error: {str(e)}"
    
    def check_instance_status(self):
        """
        Check the connection status of the configured instance
        
        Returns:
            tuple: (connected, status_info)
        """
        if not self.is_configured():
            return False, "Evolution API is not properly configured"
        
        try:
            # Use appropriate endpoints based on API version
            if self.settings_data.get('evolution_version') == '1.8.x':
                url = f"{self.settings_data.get('evolution_url')}/instance/connectionState/{self.settings_data.get('evolution_instance')}"
            else:
                url = f"{self.settings_data.get('evolution_url')}/instance/status"
            
            headers = {
                'Content-Type': 'application/json',
                'apikey': self.settings_data.get('evolution_api_key')
            }
            
            # For v2, we need to include instance in the body
            payload = None
            if self.settings_data.get('evolution_version') != '1.8.x':
                payload = {"instance": self.settings_data.get('evolution_instance')}
            
            response = requests.post(url, headers=headers, data=json.dumps(payload) if payload else None, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract connection state based on API version
                if self.settings_data.get('evolution_version') == '1.8.x':
                    # v1.x format
                    connected = data.get('state', '') == 'CONNECTED'
                    return connected, data
                else:
                    # v2.x format
                    status_data = data.get('instance', {}).get('state', {})
                    connected = status_data.get('state', '') == 'open'
                    return connected, status_data
            else:
                return False, f"API error: {response.status_code}"
                
        except Exception as e:
            logger.error(f"Error checking instance status: {str(e)}")
            return False, f"Error checking instance status: {str(e)}"
    
    def fetch_instances(self):
        """
        Fetch available instances from Evolution API
        
        Returns:
            tuple: (success, instances_list/error_message)
        """
        self.load_settings()  # Reload settings to get fresh data
        
        if not self.settings_data.get('evolution_url') or not self.settings_data.get('evolution_api_key'):
            return False, "Evolution API URL and API Key must be configured"
        
        try:
            url = f"{self.settings_data.get('evolution_url')}/instance/fetchInstances"
            
            headers = {
                'apikey': self.settings_data.get('evolution_api_key')
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                instances = response.json()
                
                if isinstance(instances, list):
                    # Extract instance names
                    instance_names = []
                    for item in instances:
                        if isinstance(item, dict) and 'instance' in item and 'instanceName' in item['instance']:
                            instance_names.append(item['instance']['instanceName'])
                    
                    return True, instance_names
                else:
                    return False, "Unexpected response format from API"
            else:
                return False, f"API error: {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            return False, "Connection error: Unable to connect to Evolution API"
        except requests.exceptions.Timeout:
            return False, "Timeout error: The request timed out"
        except Exception as e:
            logger.error(f"Error fetching instances: {str(e)}")
            return False, f"Error: {str(e)}"


# Create a singleton instance
evolution_client = EvolutionClient()


def send_whatsapp_message(phone_number, student_data):
    """
    Wrapper function to send WhatsApp message
    
    Args:
        phone_number (str): Student's phone number
        student_data (dict): Dictionary with student data
        
    Returns:
        tuple: (success, message)
    """
    if not phone_number:
        return False, "No phone number provided"
    
    # Force reload settings before sending message
    evolution_client.load_settings()
    
    return evolution_client.send_message(phone_number, student_data)