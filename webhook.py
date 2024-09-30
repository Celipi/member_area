from flask import Blueprint, request, jsonify
from models import db, Course, Student, student_courses
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import IntegrityError

webhook = Blueprint('webhook', __name__)

def process_manual_webhook(data, course_id):
    status = data.get('status')
    nome = data.get('name')
    email = data.get('email')

    if not status or not nome or not email:
        return jsonify({'error': 'Status, nome e email são obrigatórios'}), 400

    if status not in ['add', 'remove']:
        return jsonify({'error': 'Status deve ser "add" ou "remove"'}), 400

    add = (status == 'add')

    return process_student(nome, email, course_id, add=add)

def process_payt_webhook(data, course_id):
    status = data.get('status')
    customer = data.get('customer', {})
    
    full_name = customer.get('name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = customer.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if status == 'paid':
        return process_student(first_name, email, course_id, add=True)
    elif status in ['canceled', 'chargeback']:
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_cartpanda_webhook(data, course_id):
    event = data.get('event')
    order = data.get('order', {})
    customer = order.get('customer', {})
    
    full_name = customer.get('full_name', '')
    first_name = customer.get('first_name', '')
    email = customer.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'order.paid':  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True)
    elif event == 'order.refunded':  # Reembolso
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_kiwify_webhook(data, course_id):
    order_status = data.get('order_status')
    customer = data.get('Customer', {})
    
    first_name = customer.get('first_name', '')
    email = customer.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if order_status == 'paid':
        return process_student(first_name, email, course_id, add=True)
    elif order_status in ['refunded', 'chargedback']:
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_hotmart_webhook(data, course_id):
    event = data.get('event')  # Mudança aqui
    event_data = data.get('data', {})
    buyer = event_data.get('buyer', {})
    
    full_name = buyer.get('name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = buyer.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'PURCHASE_APPROVED':
        return process_student(first_name, email, course_id, add=True)
    elif event in ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK']:
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_monetizze_webhook(data, course_id):
    tipo_postback = data.get('tipoPostback', {})
    codigo_postback = tipo_postback.get('codigo')
    comprador = data.get('comprador', {})
    
    full_name = comprador.get('nome', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = comprador.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if codigo_postback == 2:  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True)
    elif codigo_postback in [4, 5]:  # Reembolso ou Chargeback
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_perfectpay_webhook(data, course_id):
    sale_status_enum = data.get('sale_status_enum')
    customer = data.get('customer', {})
    
    full_name = customer.get('full_name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = customer.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if sale_status_enum == 2:  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True)
    elif sale_status_enum in [7, 9]:  # Reembolso ou Chargeback
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Status não processado'}), 200

def process_kirvano_webhook(data, course_id):
    event = data.get('event')
    customer = data.get('customer', {})
    
    full_name = customer.get('name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = customer.get('email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'SALE_APPROVED':
        return process_student(first_name, email, course_id, add=True)
    elif event in ['SALE_REFUNDED', 'SALE_CHARGEBACK']:
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_lastlink_webhook(data, course_id):
    event = data.get('Event')
    buyer_data = data.get('Data', {}).get('Buyer', {})
    
    full_name = buyer_data.get('Name', '')
    first_name = full_name.split(" ")[0] if full_name else ''
    email = buyer_data.get('Email', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if event == 'Purchase_Order_Confirmed':  # Compra Aprovada
        return process_student(first_name, email, course_id, add=True)
    elif event in ['Payment_Refund', 'Payment_Chargeback']:  # Reembolso ou Chargeback
        return process_student(first_name, email, course_id, add=False)
    else:
        return jsonify({'message': 'Evento não processado'}), 200

def process_activecampaign_webhook(data, course_id, status):
    first_name = data.get('contact[first_name]', '')
    email = data.get('contact[email]', '')

    if not first_name or not email:
        return jsonify({'error': 'Nome e email são obrigatórios'}), 400

    if status not in ['add', 'remove']:
        return jsonify({'error': 'Status deve ser "add" ou "remove"'}), 400

    add = (status == 'add')

    return process_student(first_name, email, course_id, add=add)

def process_student(nome, email, course_id, add=True):
    student = Student.query.filter_by(email=email).first()
    if not student and add:
        hashed_password = generate_password_hash('senha123')
        student = Student(email=email, password=hashed_password, name=nome)
        db.session.add(student)
        try:
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            return jsonify({'error': 'Email já está em uso'}), 400

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Curso não encontrado'}), 404

    if add:
        if course not in student.courses:
            student.courses.append(course)
        message = 'Estudante adicionado ao curso com sucesso'
    else:
        if course in student.courses:
            student.courses.remove(course)
        message = 'Estudante removido do curso com sucesso'

    try:
        db.session.commit()
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

@webhook.route('/webhook/<platform>/<int:course_id>', methods=['POST'])
def receive_webhook(platform, course_id):
    data = request.json

    if platform == 'manual':
        return process_manual_webhook(data, course_id)
    elif platform == 'payt':
        return process_payt_webhook(data, course_id)
    elif platform == 'cartpanda':
        return process_cartpanda_webhook(data, course_id)
    elif platform == 'kiwify':
        return process_kiwify_webhook(data, course_id)
    elif platform == 'hotmart':
        return process_hotmart_webhook(data, course_id)
    elif platform == 'monetizze':
        return process_monetizze_webhook(data, course_id)
    elif platform == 'perfectpay':
        return process_perfectpay_webhook(data, course_id)
    elif platform == 'kirvano':
        return process_kirvano_webhook(data, course_id)
    elif platform == 'lastlink':
        return process_lastlink_webhook(data, course_id)
    elif platform == 'activecampaign':
        status = request.args.get('status')
        if not status:
            return jsonify({'error': 'O parâmetro status é obrigatório'}), 400
        return process_activecampaign_webhook(data, course_id, status)
    else:
        return jsonify({'error': 'Plataforma não suportada'}), 400