import re
import requests
import json
from models import Settings, db, Course, Admin

def format_description(description):
    # Check if the description already contains HTML formatting
    if description and ('<p>' in description.lower() or '<a' in description.lower() or '<br' in description.lower() or 
                      '<strong>' in description.lower() or '<em>' in description.lower()):
        # Already formatted HTML, just return it as is
        return description
    
    # If not, apply formatting for plain text
    # Identifica URLs e as transforma em links HTML
    url_pattern = r'https?://\S+'
    description = re.sub(url_pattern, lambda m: f'<a href="{m.group(0)}" target="_blank" class="text-blue-400 hover:underline">{m.group(0)}</a>', description)
    
    # Substitui quebras de linha por tags <br>
    description = description.replace('\n', '<br>')
    
    return description

def get_or_create_settings():
    """Get existing settings or create new ones if they don't exist"""
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
        db.session.commit()
    return settings

def update_user_settings(admin, email=None, current_password=None, new_password=None):
    """Update admin user settings"""
    updated = False
    message = "Nenhuma alteração realizada."
    
    # Atualizar email se fornecido
    if email and email != admin.email:
        admin.email = email
        updated = True
        message = "Email atualizado com sucesso."
    
    # Atualizar senha se fornecida
    if current_password and new_password:
        if admin.check_password(current_password):
            admin.set_password(new_password)
            updated = True
            message = "Informações atualizadas com sucesso."
        else:
            return False, "Senha atual incorreta."
    
    if updated:
        db.session.commit()
        
    return updated, message

def format_brevo_template(template, data):
    """
    Converte um template text em HTML para envio via Brevo, substituindo as tags e tratando links
    """
    # Primeiro substitui todas as variáveis, exceto [link]
    for key, value in data.items():
        if key != 'link':
            template = template.replace(f'[[{key}]]', str(value))
    
    # Se houver link, substitui por um HTML link
    if 'link' in data:
        template = template.replace('[[link]]', f'<a href="{data["link"]}">{data["link"]}</a>')
    
    # Converte quebras de linha em <br>
    html_content = template.replace('\n', '<br>')
    
    # Retorna o HTML final dentro da estrutura de um email HTML básico
    return f"""
    <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            {html_content}
        </body>
    </html>
    """

def send_brevo_email(student_name, student_email, course, password, base_url, settings_dict=None, student=None):
    """
    Envia um email usando a API da Brevo.
    """
    try:
        if not settings_dict:
            print("Erro: settings_dict não fornecido")
            return False, "Configurações não fornecidas"
        
        if not settings_dict.get('brevo_enabled'):
            print("Erro: Brevo não está habilitado")
            return False, "Brevo não está habilitado"
        
        if not settings_dict.get('brevo_api_key'):
            print("Erro: API Key da Brevo não configurada")
            return False, "API Key da Brevo não configurada"

        # Preparar os dados para substituição no template
        data = {
            'name': student_name,
            'first_name': student_name.split()[0] if student_name else "",
            'email': student_email,
            'password': password,
            'curso': course.name if course else "",
            'link': f"{base_url}/login",
            'fast_link': f"{base_url}/access/{student.uuid}" if student and student.uuid else ""
        }
        
        # Usar o sender_name e sender_email das configurações
        sender_name = settings_dict.get('sender_name') or "Suporte"
        sender_email = settings_dict.get('sender_email') or settings_dict.get('support_email')
        
        if not sender_email:
            print("Erro: Email do remetente não configurado")
            return False, "Email do remetente não configurado"
        
        # Obter e formatar o template
        template = settings_dict.get('brevo_email_template')
        if not template:
            print("Erro: Template de email não configurado")
            return False, "Template de email não configurado"
        
        # Formatar o template em HTML
        html_content = format_brevo_template(template, data)
        
        # Obter e formatar o assunto
        subject = settings_dict.get('brevo_email_subject', 'Bem-vindo ao seu curso')
        for key, value in data.items():
            subject = subject.replace(f"[[{key}]]", str(value))
        
        # Preparar os dados para a API da Brevo
        payload = {
            'sender': {
                'name': sender_name,
                'email': sender_email
            },
            'to': [
                {
                    'email': student_email,
                    'name': student_name
                }
            ],
            'subject': subject,
            'htmlContent': html_content
        }
        
        # Configurar a requisição
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            'accept': 'application/json',
            'api-key': settings_dict['brevo_api_key'],
            'content-type': 'application/json'
        }

        # Log da requisição
        print("\n=== Requisição para API Brevo ===")
        print(f"URL: {url}")
        print("Headers:", json.dumps({k: v if k != 'api-key' else '[REDACTED]' for k, v in headers.items()}, indent=2))
        print("Payload:", json.dumps(payload, indent=2, ensure_ascii=False))
        
        # Enviar o email
        response = requests.post(url, headers=headers, json=payload)
        
        # Log da resposta
        print("\n=== Resposta da API Brevo ===")
        print(f"Status Code: {response.status_code}")
        try:
            print("Response:", json.dumps(response.json(), indent=2, ensure_ascii=False))
        except:
            print("Response:", response.text)
        print("=====================================\n")
        
        if response.status_code >= 200 and response.status_code < 300:
            print("Email enviado com sucesso!")
            return True, "Email enviado com sucesso"
        else:
            error_message = f"Erro ao enviar email. Status: {response.status_code}, Resposta: {response.text}"
            print(error_message)
            return False, error_message
            
    except Exception as e:
        error_message = f"Erro ao enviar email: {str(e)}"
        print(error_message)
        return False, error_message