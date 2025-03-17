from flask import Blueprint, request, jsonify, current_app
from models import db, Course, Student, student_courses, Settings
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import IntegrityError
from utils import send_brevo_email
from evolutionapi import send_whatsapp_message
import urllib.parse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

webhook = Blueprint('webhook', __name__)

def get_settings_dict():
    """Retorna as configurações como um dicionário para uso no worker"""
    settings = Settings.query.first()
    if settings:
        return {
            'brevo_enabled': settings.brevo_enabled,
            'brevo_api_key': settings.brevo_api_key,
            'brevo_email_subject': settings.brevo_email_subject,
            'brevo_email_template': settings.brevo_email_template,
            'sender_name': settings.sender_name,
            'sender_email': settings.sender_email,
            'support_email': settings.support_email,
            'evolution_enabled': settings.evolution_enabled,
            'evolution_url': settings.evolution_url,
            'evolution_api_key': settings.evolution_api_key,
            'evolution_message_template': settings.evolution_message_template,
            'evolution_version': settings.evolution_version,
            'evolution_instance': settings.evolution_instance
        }
    return {}

def process_manual_webhook(data, course_id):
    status = data.get('status')
    nome = data.get('name')
    email = data.get('email')
    phone = data.get('phone', '')  # Get optional phone number

    if not status or not nome or not email:
        return jsonify({'error': 'Status, nome e email são obrigatórios'}), 400

    if status not in ['add', 'remove']:
        return jsonify({'error': 'Status deve ser "add" ou "remove"'}), 400

    add = (status == 'add')

    return process_student(nome, email, course_id, add=add, phone=phone)

def process_payt_webhook(data, course_id):
    status = data.get('status')
    customer = data.get('customer', {})
    
    full_name = customer.get('name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = customer.get('email', '')
    phone = customer.get('phone', '')  # novo: capturando phone

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if status == 'paid':
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif status in ['canceled', 'chargeback']:
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_cartpanda_webhook(data, course_id):
    event = data.get('event')
    order = data.get('order', {})
    customer = order.get('customer', {})
    
    full_name = customer.get('full_name', '')
    first_name = customer.get('first_name', '')
    email = customer.get('email', '')
    phone = customer.get('phone', '')  # novo: capturando phone

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'order.paid':  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif event == 'order.refunded':  # Reembolso
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_kiwify_webhook(data, course_id):
    order_status = data.get('order_status')
    customer = data.get('Customer', {})
    
    first_name = customer.get('first_name', '')
    email = customer.get('email', '')
    mobile = customer.get('mobile', '')  # novo: capturando mobile
    
    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if order_status == 'paid':
        return process_student(first_name, email, course_id, add=True, phone=mobile)
    elif order_status in ['refunded', 'chargedback']:
        return process_student(first_name, email, course_id, add=False, phone=mobile)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_hotmart_webhook(data, course_id):
    event = data.get('event')  # Mudança aqui
    event_data = data.get('data', {})
    buyer = event_data.get('buyer', {})
    
    full_name = buyer.get('name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = buyer.get('email', '')
    phone = buyer.get('checkout_phone', '')  # novo: capturando checkout_phone

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'PURCHASE_APPROVED':
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif event in ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK']:
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_monetizze_webhook(data, course_id):
    tipo_postback = data.get('tipoPostback', {})
    codigo_postback = tipo_postback.get('codigo')
    comprador = data.get('comprador', {})
    
    full_name = comprador.get('nome', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = comprador.get('email', '')
    phone = comprador.get('telefone', '')  # novo: capturando telefone

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if codigo_postback == 2:  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif codigo_postback in [4, 5]:  # Reembolso ou Chargeback
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_perfectpay_webhook(data, course_id):
    sale_status_enum = data.get('sale_status_enum')
    customer = data.get('customer', {})
    
    full_name = customer.get('full_name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = customer.get('email', '')
    phone = customer.get('phone_number', '')  # novo: capturando phone_number
    
    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if sale_status_enum == 2:  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif sale_status_enum in [7, 9]:  # Reembolso ou Chargeback
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_kirvano_webhook(data, course_id):
    event = data.get('event')
    customer = data.get('customer', {})
    
    full_name = customer.get('name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = customer.get('email', '')
    phone = customer.get('phone_number', '')  # novo: capturando phone_number
    
    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'SALE_APPROVED':
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif event in ['SALE_REFUNDED', 'SALE_CHARGEBACK']:
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_lastlink_webhook(data, course_id):
    event = data.get('Event')
    buyer_data = data.get('Data', {}).get('Buyer', {})
    
    full_name = buyer_data.get('Name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = buyer_data.get('Email', '')
    phone = buyer_data.get('PhoneNumber', '')  # novo: capturando PhoneNumber

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'Purchase_Order_Confirmed':  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True, phone=phone)
    elif event in ['Payment_Refund', 'Payment_Chargeback']:  # Reembolso ou Chargeback
        return process_student(first_name, email, course_id, add=False, phone=phone)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_activecampaign_webhook(data, course_id, status):
    first_name = data.get('contact[first_name]', '')
    email = data.get('contact[email]', '')
    phone = data.get('contact[phone]', '')  # Get phone if available

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if status not in ['add', 'remove']:
        return jsonify({'error': 'Status deve ser "add" ou "remove"'}), 400

    add = (status == 'add')

    return process_student(first_name, email, course_id, add=add, phone=phone)

def process_student(nome, email, course_id, add=True, password=None, phone=None):
    """
    Process student addition/removal and handle email and WhatsApp notifications.
    Notification rules:
    1. If Brevo is enabled, attempt to send email
    2. If Evolution API is enabled AND phone is provided, attempt to send WhatsApp
    3. If both are enabled, attempt both
    4. If both fail, continue with student processing
    """
    logger.info("\n=== Processando estudante ===")
    logger.info(f"Nome: {nome}")
    logger.info(f"Email: {email}")
    logger.info(f"Phone: {phone}")
    logger.info(f"Course ID: {course_id}")
    logger.info(f"Ação: {'Adicionar' if add else 'Remover'}")

    student = Student.query.filter_by(email=email).first()
    if not student and add:
        # Gerar senha se não fornecida
        if not password:
            password = 'senha123'
        logger.info(f"Senha gerada: {password}")
        hashed_password = generate_password_hash(password)
        student = Student(email=email, password=hashed_password, name=nome, phone=phone)
        db.session.add(student)
        try:
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            return jsonify({'error': 'Email já está em uso'}), 400
    elif student and phone and not student.phone:
        # Update phone number if not set yet
        student.phone = phone
        logger.info(f"Atualizado telefone para: {phone}")

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Curso não encontrado'}), 404

    if add:
        if course not in student.courses:
            student.courses.append(course)
            message = 'Estudante adicionado ao curso com sucesso'
            
            # Get settings
            settings_dict = {}
            
            try:
                settings = Settings.query.first()
                logger.info("\n=== Verificando configurações ===")
                logger.info(f"Settings encontrado: {settings is not None}")
                
                # Store settings in a dictionary to avoid session issues
                if settings:
                    settings_dict = {
                        'brevo_enabled': settings.brevo_enabled,
                        'brevo_api_key': settings.brevo_api_key,
                        'brevo_email_subject': settings.brevo_email_subject,
                        'brevo_email_template': settings.brevo_email_template,
                        'sender_name': settings.sender_name,
                        'sender_email': settings.sender_email,
                        'support_email': settings.support_email,
                        'evolution_enabled': settings.evolution_enabled,
                        'evolution_url': settings.evolution_url,
                        'evolution_api_key': settings.evolution_api_key,
                        'evolution_message_template': settings.evolution_message_template,
                        'evolution_version': settings.evolution_version,
                        'evolution_instance': settings.evolution_instance
                    }
            except Exception as e:
                logger.error(f"Error loading settings: {str(e)}")
            
            # Prepare base URL for links
            if request.headers.get('X-Forwarded-Proto') and request.headers.get('X-Forwarded-Host'):
                base_url = f"{request.headers.get('X-Forwarded-Proto')}://{request.headers.get('X-Forwarded-Host')}"
            else:
                base_url = request.url_root.rstrip('/')
            
            logger.info(f"Base URL: {base_url}")
            
            # Prepare student data for templates
            student_data = {
                'name': student.name,
                'first_name': student.name.split()[0] if student.name else student.name,
                'email': student.email,
                'password': password,
                'link': f"{base_url}/login",
                'fast_link': f"{base_url}/access/{student.uuid}",
                'curso': course.name
            }
            
            # Boolean flags to track notification sending
            brevo_sent = False
            whatsapp_sent = False
            
            # 1. Check if Brevo is enabled and properly configured
            brevo_enabled = settings_dict.get('brevo_enabled', False)
            brevo_api_key = settings_dict.get('brevo_api_key')
            
            if brevo_enabled and brevo_api_key:
                try:
                    logger.info("\n=== Preparando envio de email via Brevo ===")
                    
                    # Send email - Now passing the student object
                    success, email_message = send_brevo_email(
                        student.name,
                        student.email,
                        course,
                        password,
                        base_url,
                        settings_dict,
                        student  # Pass the student object
                    )
                    
                    brevo_sent = success
                    logger.info(f"Brevo email enviado: {success}")
                    logger.info(f"Mensagem Brevo: {email_message}")
                        
                except Exception as e:
                    logger.error(f"\nErro ao processar envio de email via Brevo: {str(e)}")
                    brevo_sent = False
            else:
                logger.info("Brevo não está configurado ou habilitado")
            
            # 2. Check if Evolution API is enabled and properly configured
            evolution_enabled = settings_dict.get('evolution_enabled', False)
            evolution_api_key = settings_dict.get('evolution_api_key')
            has_phone = student.phone is not None and len(student.phone) > 0
            
            if evolution_enabled and evolution_api_key and has_phone:
                try:
                    logger.info("\n=== Preparando envio de WhatsApp via Evolution API ===")
                    logger.info(f"Telefone do aluno: {student.phone}")
                    logger.info(f"Evolution API version: {settings_dict.get('evolution_version')}")
                    logger.info(f"Evolution API instance: {settings_dict.get('evolution_instance')}")
                    
                    # Send WhatsApp message - commit the session first to avoid session issues
                    db.session.commit()
                    
                    success, whatsapp_message = send_whatsapp_message(
                        student.phone,
                        student_data
                    )
                    
                    whatsapp_sent = success
                    logger.info(f"WhatsApp enviado: {success}")
                    logger.info(f"Mensagem WhatsApp: {whatsapp_message}")
                        
                except Exception as e:
                    logger.error(f"\nErro ao processar envio de WhatsApp via Evolution API: {str(e)}")
                    whatsapp_sent = False
            elif evolution_enabled and evolution_api_key and not has_phone:
                logger.info("Evolution API está habilitada mas o aluno não tem telefone cadastrado")
            else:
                logger.info("Evolution API não está configurada ou habilitada")
            
            # Log summary of notifications
            logger.info("\n=== Resumo de notificações ===")
            logger.info(f"Email via Brevo: {'Enviado' if brevo_sent else 'Não enviado'}")
            logger.info(f"WhatsApp via Evolution: {'Enviado' if whatsapp_sent else 'Não enviado'}")
    else:
        if course in student.courses:
            student.courses.remove(course)
        message = 'Estudante removido do curso com sucesso'

    try:
        db.session.commit()
        logger.info("\nOperação concluída com sucesso")
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Erro ao salvar os dados'}), 500

    return jsonify({'message': message}), 200

@webhook.route('/webhook/activecampaign/<int:course_id>', methods=['POST'])
def receive_activecampaign_webhook(course_id):
    status = request.args.get('status')

    if not status:
        return jsonify({'error': 'O parâmetro status é obrigatório'}), 400

    # Obter os dados do corpo da requisição
    data = request.form.to_dict()

    if not data:
        # Se não houver dados no form, tenta obter do JSON
        data = request.get_json(force=True, silent=True)

    if not data:
        return jsonify({'error': 'Dados da requisição não encontrados'}), 400

    return process_activecampaign_webhook(data, course_id, status)

@webhook.route('/webhook/<platform>/<uuid>', methods=['POST'])
def receive_webhook(platform, uuid):
    course = Course.query.filter_by(uuid=uuid).first()
    if not course:
        return jsonify({'error': 'Curso não encontrado'}), 404
    data = request.json

    if platform == 'manual':
        return process_manual_webhook(data, course.id)
    elif platform == 'payt':
        return process_payt_webhook(data, course.id)
    elif platform == 'cartpanda':
        return process_cartpanda_webhook(data, course.id)
    elif platform == 'kiwify':
        return process_kiwify_webhook(data, course.id)
    elif platform == 'hotmart':
        return process_hotmart_webhook(data, course.id)
    elif platform == 'monetizze':
        return process_monetizze_webhook(data, course.id)
    elif platform == 'perfectpay':
        return process_perfectpay_webhook(data, course.id)
    elif platform == 'kirvano':
        return process_kirvano_webhook(data, course.id)
    elif platform == 'lastlink':
        return process_lastlink_webhook(data, course.id)
    elif platform == 'activecampaign':
        status = request.args.get('status')
        if not status:
            return jsonify({'error': 'O parâmetro status é obrigatório'}), 400
        return process_activecampaign_webhook(data, course.id, status)
    else:
        return jsonify({'error': 'Plataforma não suportada'}), 400