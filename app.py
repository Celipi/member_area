from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session, abort
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os
from datetime import datetime
from models import db, Course, Admin, Student, Module, Lesson, Document, Settings, student_courses, student_lessons, Promotion, Showcase
from sqlalchemy import func, or_
from utils import format_description
import csv
import json
from flask import Response, stream_with_context
import io
from werkzeug.utils import secure_filename
import re
from sqlalchemy.exc import IntegrityError
from promote import promote
from showcase import showcase
import pytz
from models import ShowcaseAnalytics
from faq import faq
from faq_ai import faq_ai
from chatbot import chatbot

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL']
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Decoradores
def check_installation():
    with app.app_context():
        admin = Admin.query.first()
        return admin is not None and admin.is_installed

def installation_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not check_installation() and request.endpoint != 'install':
            return redirect(url_for('install'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or not Admin.query.get(session['user_id']):
            flash('Você precisa estar logado como administrador para acessar esta página.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def student_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or not Student.query.get(session['user_id']):
            flash('Você precisa estar logado como aluno para acessar esta página.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Rotas
@app.route('/')
@installation_required
def index():
    if 'user_id' in session:
        if 'user_type' in session:
            if session['user_type'] == 'admin':
                return redirect(url_for('admin_panel'))
            elif session['user_type'] == 'student':
                return redirect(url_for('dashboard'))
    
    # Se não estiver logado, verifica se a instalação foi concluída
    if check_installation():
        return redirect(url_for('login'))
    else:
        return redirect(url_for('install'))

@app.route('/install', methods=['GET', 'POST'])
def install():
    if check_installation():
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        platform_name = request.form['platform_name']
        email = request.form['email']
        password = request.form['password']
        
        hashed_password = generate_password_hash(password)
        new_admin = Admin(email=email, password=hashed_password, platform_name=platform_name, is_installed=True)
        
        db.create_all()
        db.session.add(new_admin)
        db.session.commit()
        
        flash('Instalação concluída com sucesso!', 'success')
        return redirect(url_for('login'))
    
    return render_template('installation.html')

@app.route('/installation', methods=['GET'])
def installation_redirect():
    # Redireciona para login se já estiver instalado, caso contrário redireciona para instalação
    if check_installation():
        return redirect(url_for('login'))
    else:
        return redirect(url_for('install'))

@app.route('/login', methods=['GET', 'POST'])
@installation_required
def login():
    if 'user_id' in session:
        if session['user_type'] == 'admin':
            return redirect(url_for('admin_panel'))
        elif session['user_type'] == 'student':
            return redirect(url_for('dashboard'))
    
    # Obter o nome da plataforma do primeiro admin
    admin = Admin.query.first()
    platform_name = admin.platform_name if admin else 'MembriumWL'
    
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        admin = Admin.query.filter_by(email=email).first()
        if admin and check_password_hash(admin.password, password):
            session['user_id'] = admin.id
            session['user_type'] = 'admin'
            return redirect(url_for('admin_panel'))
        
        student = Student.query.filter_by(email=email).first()
        if student and check_password_hash(student.password, password):
            session['user_id'] = student.id
            session['user_type'] = 'student'
            return redirect(url_for('dashboard'))
        
        flash('Email ou senha inválidos.', 'error')
    
    return render_template('login.html', platform_name=platform_name)

@app.before_request
def check_admin_routes():
    if request.path.startswith('/admin'):
        if 'user_type' not in session or session['user_type'] != 'admin':
            flash('Acesso não autorizado.', 'error')
            return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/admin/courses', methods=['GET'])
@admin_required
@installation_required
def get_courses():
    courses = Course.query.all()
    return jsonify([{
        'id': course.id,
        'uuid': course.uuid,
        'name': course.name,
        'description': course.description,
        'image_url': url_for('static', filename=f'uploads/{course.image}') if course.image else None
    } for course in courses])

@app.route('/admin')
@admin_required
@installation_required
def admin_panel():
    # Verificar se o usuário atual é realmente um administrador
    current_user_id = session.get('user_id')
    current_user = Admin.query.get(current_user_id)
    
    if not current_user:
        # Se o usuário não for encontrado na tabela Admin, negue o acesso
        abort(403)  # Forbidden

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # Se for uma requisição AJAX, retorne o nome da plataforma
        return jsonify({'platform_name': current_user.platform_name})
    else:
        # Se for uma requisição normal, renderize o painel de administração
        courses = Course.query.all()
        return render_template('admin_panel.html', courses=courses)

@app.route('/admin/students-panel')
@admin_required
@installation_required
def students_panel():
    # Renderiza a página do painel de alunos
    return render_template('students_panel.html')

@app.route('/admin/course', methods=['POST'])
@admin_required
def create_course():
    name = request.form['name']
    description = request.form['description']
    image = request.files.get('image')
    
    if image:
        filename = f"course_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        image.save(os.path.join('static/uploads', filename))
    else:
        filename = None
    
    new_course = Course(name=name, description=description, image=filename)
    db.session.add(new_course)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/admin/course/<int:course_id>', methods=['PUT'])
@admin_required
def update_course(course_id):
    course = Course.query.get_or_404(course_id)
    course.name = request.form['name']
    course.description = request.form['description']
    
    image = request.files.get('image')
    if image:
        if course.image:
            os.remove(os.path.join('static/uploads', course.image))
        filename = f"course_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        image.save(os.path.join('static/uploads', filename))
        course.image = filename
    
    db.session.commit()
    flash('Curso atualizado com sucesso!', 'success')
    return jsonify({'success': True})

@app.route('/admin/course/<int:course_id>', methods=['GET'])
@admin_required
def get_course(course_id):
    course = Course.query.get_or_404(course_id)
    return jsonify({
        'id': course.id,
        'name': course.name,
        'description': course.description,
        'image_url': url_for('static', filename=f'uploads/{course.image}') if course.image else None
    })

@app.route('/admin/course/<int:course_id>', methods=['DELETE'])
@admin_required
def delete_course(course_id):
    course = Course.query.get_or_404(course_id)
    if course.image:
        os.remove(os.path.join('static/uploads', course.image))
    db.session.delete(course)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/students', methods=['GET'])
@admin_required
def get_students():
    page = request.args.get('page', 1, type=int)
    per_page = 10
    search = request.args.get('search', '')
    course_filter = request.args.get('course', '')

    query = Student.query

    if search:
        query = query.filter(or_(
            Student.name.ilike(f'%{search}%'),
            Student.email.ilike(f'%{search}%')
        ))
    
    # Adiciona filtro por curso se um ID de curso for fornecido
    if course_filter:
        try:
            course_id = int(course_filter)
            query = query.join(Student.courses).filter(Course.id == course_id)
        except (ValueError, TypeError):
            # Se não for possível converter para int, ignora o filtro
            pass

    students = query.order_by(Student.name).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'students': [{
            'id': student.id,
            'name': student.name,
            'email': student.email,
            'phone': student.phone,
            'uuid': student.uuid,
            'courses': [{'id': course.id, 'name': course.name} for course in student.courses]
        } for student in students.items],
        'pages': students.pages,
        'current_page': page
    })

@app.route('/admin/total-students', methods=['GET'])
@admin_required
def get_total_students():
    total = Student.query.count()
    return jsonify({'total': total})

@app.route('/admin/total-lessons', methods=['GET'])
@admin_required
def get_total_lessons():
    total = Lesson.query.count()  # Count total lessons
    return jsonify({'total': total})

@app.route('/admin/student', methods=['POST'])
@admin_required
def create_student():
    email = request.form['email']
    password = request.form['password']
    name = request.form['name']
    course_id = request.form['courses']  # Agora esperamos apenas um ID de curso
    phone = request.form.get('phone', '')  # Get phone (optional)
    
    # Criar o hash da senha
    hashed_password = generate_password_hash(password)
    
    try:
        # Criar novo estudante
        new_student = Student(email=email, password=hashed_password, name=name, phone=phone)
        db.session.add(new_student)
        db.session.flush()  # Isso atribui um ID ao novo_student sem commitar a transação
        
        # Obter o curso
        course = Course.query.get(course_id)
        if not course:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Curso não encontrado'}), 404
        
        # Associar o estudante ao curso
        new_student.courses.append(course)
        
        # Commit da transação
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Aluno criado com sucesso'})
    
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Email já está em uso'}), 400
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/course/<int:course_id>/details', methods=['GET'])
@admin_required
def get_course_details(course_id):
    course = Course.query.get_or_404(course_id)
    return jsonify({
        'id': course.id,
        'name': course.name,
        'description': course.description,
        'image': course.image,
        'modules': [{
            'id': module.id,
            'name': module.name,
            'image': module.image,
            'order': module.order,
            'lessons': [{
                'id': lesson.id,
                'title': lesson.title,
                'description': lesson.description,
                'video_url': lesson.video_url,
                'video_type': lesson.video_type,
                'order': lesson.order,
                'has_button': lesson.has_button,
                'button_text': lesson.button_text,
                'button_link': lesson.button_link,
                'button_delay': lesson.button_delay
            } for lesson in module.lessons]
        } for module in course.modules]
    })

@app.route('/admin/course-students-stats')
@admin_required
def course_students_stats():
    stats = db.session.query(
        Course.name.label('course_name'),
        func.count(db.column('student_id')).label('student_count')
    ).select_from(db.table('student_courses')).join(
        Course, Course.id == db.column('course_id')
    ).group_by(
        Course.id, Course.name
    ).all()

    return jsonify([
        {'course_name': stat.course_name, 'student_count': stat.student_count}
        for stat in stats
    ])

@app.route('/admin/course/<int:course_id>/module', methods=['POST'])
@admin_required
def create_module(course_id):
    course = Course.query.get_or_404(course_id)
    name = request.form['name']
    image = request.files['image']
    
    if image:
        filename = f"module_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        image.save(os.path.join('static/uploads', filename))
    else:
        filename = None
    
    new_module = Module(name=name, image=filename, course=course, order=len(course.modules) + 1)
    db.session.add(new_module)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'module': {
            'id': new_module.id,
            'name': new_module.name,
            'image': new_module.image,
            'order': new_module.order
        }
    })

@app.route('/admin/module/<int:module_id>', methods=['PUT'])
@admin_required
def update_module(module_id):
    module = Module.query.get_or_404(module_id)
    module.name = request.form['name']
    
    image = request.files.get('image')
    if image:
        if module.image:
            os.remove(os.path.join('static/uploads', module.image))
        filename = f"module_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        image.save(os.path.join('static/uploads', filename))
        module.image = filename
    
    db.session.commit()
    flash('Módulo atualizado com sucesso!', 'success')
    return jsonify({'success': True})

@app.route('/admin/module/<int:module_id>', methods=['DELETE'])
@admin_required
def delete_module(module_id):
    module = Module.query.get_or_404(module_id)
    if module.image:
        os.remove(os.path.join('static/uploads', module.image))
    db.session.delete(module)
    db.session.commit()
    flash('Módulo excluído com sucesso!', 'success')
    return jsonify({'success': True})

@app.route('/admin/module/<int:module_id>/lesson', methods=['POST'])
@admin_required
def create_lesson(module_id):
    module = Module.query.get_or_404(module_id)
    title = request.form['title']
    description = request.form['description']
    video_url = request.form['video_url']
    video_type = request.form['video_type']
    
    has_button = request.form.get('has_button', 'false').lower() == 'true'
    button_text = request.form.get('button_text') if has_button else None
    button_link = request.form.get('button_link') if has_button else None
    button_delay = request.form.get('appearance_time')

    # Converter para inteiro se não for None ou string vazia
    if button_delay and button_delay.strip():
        button_delay = int(button_delay)
    else:
        button_delay = None

    new_lesson = Lesson(
        title=title, 
        description=description, 
        video_url=video_url, 
        video_type=video_type, 
        module=module, 
        order=len(module.lessons) + 1,
        has_button=has_button,
        button_text=button_text,
        button_link=button_link,
        button_delay=button_delay
    )
    db.session.add(new_lesson)
    
    documents = request.files.getlist('documents')
    for doc in documents:
        if doc:
            filename = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{doc.filename}"
            doc.save(os.path.join('static/uploads', filename))
            new_document = Document(filename=filename, lesson=new_lesson)
            db.session.add(new_document)
    
    db.session.commit()
    return jsonify({
        'success': True, 
        'lesson': {
            'id': new_lesson.id,
            'title': new_lesson.title,
            'description': new_lesson.description,
            'video_url': new_lesson.video_url,
            'video_type': new_lesson.video_type,
            'order': new_lesson.order,
            'has_button': new_lesson.has_button,
            'button_text': new_lesson.button_text,
            'button_link': new_lesson.button_link,
            'button_delay': new_lesson.button_delay
        }
    })

@app.route('/admin/lesson/<int:lesson_id>', methods=['PUT'])
@admin_required
def update_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    lesson.title = request.form['title']
    lesson.description = request.form['description']
    lesson.video_url = request.form['video_url']
    lesson.video_type = request.form['video_type']
    
    has_button = request.form.get('has_button', 'false').lower() == 'true'
    lesson.has_button = has_button
    lesson.button_text = request.form.get('button_text') if has_button else None
    lesson.button_link = request.form.get('button_link') if has_button else None
    button_delay = request.form.get('appearance_time')

    if button_delay and button_delay.strip():
        lesson.button_delay = int(button_delay)
    else:
        lesson.button_delay = None
    
    documents = request.files.getlist('documents')
    for doc in documents:
        if doc:
            filename = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{doc.filename}"
            doc.save(os.path.join('static/uploads', filename))
            new_document = Document(filename=filename, lesson=lesson)
            db.session.add(new_document)
    
    db.session.commit()
    return jsonify({
        'success': True,
        'lesson': {
            'id': lesson.id,
            'title': lesson.title,
            'description': lesson.description,
            'video_url': lesson.video_url,
            'video_type': lesson.video_type,
            'order': lesson.order,
            'has_button': lesson.has_button,
            'button_text': lesson.button_text,
            'button_link': lesson.button_link,
            'button_delay': lesson.button_delay
        }
    })

@app.route('/admin/lesson/<int:lesson_id>', methods=['DELETE'])
@admin_required
def delete_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    for doc in lesson.documents:
        os.remove(os.path.join('static/uploads', doc.filename))
    db.session.delete(lesson)
    db.session.commit()
    flash('Aula excluída com sucesso!', 'success')
    return jsonify({'success': True})

@app.route('/admin/reorder_modules', methods=['POST'])
@admin_required
def reorder_modules():
    new_order = request.json['new_order']
    for index, module_id in enumerate(new_order, start=1):
        module = Module.query.get(module_id)
        module.order = index
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/reorder_lessons', methods=['POST'])  # Fix: Changed methods['POST'] to methods=['POST']
@admin_required
def reorder_lessons():
    new_order = request.json['new_order']
    for index, lesson_id in enumerate(new_order, start=1):
        lesson = Lesson.query.get(lesson_id)
        lesson.order = index
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/course/<int:course_id>/modification')
@admin_required
def course_modification(course_id):
    course = Course.query.get_or_404(course_id)
    return render_template('course_modification.html', course=course)

@app.route('/admin/student/<int:student_id>', methods=['GET'])
@admin_required
def get_student(student_id):
    student = Student.query.get_or_404(student_id)
    return jsonify({
        'id': student.id,
        'name': student.name,
        'email': student.email,
        'phone': student.phone,  # Add phone to response
        'courses': [course.id for course in student.courses]
    })

@app.route('/admin/student/<int:student_id>', methods=['PUT'])
@admin_required
def update_student(student_id):
    student = Student.query.get_or_404(student_id)
    action = request.form['action']
    
    try:
        if action == 'update':
            student.name = request.form['name']
            student.email = request.form['email']
            student.phone = request.form.get('phone', student.phone)  # Update phone if provided
            if request.form['password']:
                student.password = generate_password_hash(request.form['password'])
        
        elif action == 'include':
            course_id = request.form['course']
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'success': False, 'message': 'Curso não encontrado'}), 404
            
            if course not in student.courses:
                student.courses.append(course)
        
        elif action == 'remove':
            course_id = request.form['course']
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'success': False, 'message': 'Curso não encontrado'}), 404
            
            if course in student.courses:
                student.courses.remove(course)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Aluno atualizado com sucesso'})
    
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Email já está em uso'}), 400
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/student/<int:student_id>', methods=['DELETE'])
@admin_required
def delete_student(student_id):
    student = Student.query.get_or_404(student_id)
    db.session.delete(student)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/preview_course/<int:course_id>')
@admin_required
def preview_course(course_id):
    course = Course.query.get_or_404(course_id)
    return render_template('preview_course.html', course=course)

# Rota para a API que fornece detalhes do curso para pré-visualização
@app.route('/api/preview_course/<int:course_id>')
@admin_required
def api_preview_course_details(course_id):
    course = Course.query.get_or_404(course_id)
    return jsonify({
        'id': course.id,
        'title': course.name,
        'description': course.description,
        'modules': [{
            'id': module.id,
            'title': module.name,
            'image': module.image or '/static/default-module-image.jpg',
            'lessons': [{'id': lesson.id, 'title': lesson.title} for lesson in module.lessons]
        } for module in course.modules]
    })

# Rota para a pré-visualização das aulas de um módulo
@app.route('/preview_course/<int:course_id>/module/<int:module_id>/lesson/<int:lesson_order>')
@admin_required
def preview_lessons(course_id, module_id, lesson_order):
    course = Course.query.get_or_404(course_id)
    module = Module.query.filter_by(id=module_id, course_id=course_id).first_or_404()
    
    lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
    
    if lesson_order < 1 or lesson_order > len(lessons):
        return redirect(url_for('preview_lessons', course_id=course_id, module_id=module_id, lesson_order=1))
    
    current_lesson = next((lesson for lesson in lessons if lesson.order == lesson_order), None)
    if not current_lesson:
        abort(404)
    
    # Formatar a descrição da lição
    formatted_description = format_description(current_lesson.description)
    
    document = Document.query.filter_by(lesson_id=current_lesson.id).first()
    
    return render_template('preview_lessons.html', 
                           course=course,
                           module=module,
                           lessons=lessons,
                           current_lesson=current_lesson,
                           formatted_description=formatted_description,
                           document=document)

# Rota para obter detalhes de uma aula específica (se necessário)
@app.route('/api/preview_lesson/<int:lesson_id>')
@admin_required
def api_preview_lesson_details(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    return jsonify({
        'id': lesson.id,
        'title': lesson.title,
        'description': lesson.description,
        'video_url': lesson.video_url,
        'video_type': lesson.video_type,
        'documents': [{'id': doc.id, 'filename': doc.filename} for doc in lesson.documents]
    })

@app.route('/dashboard')
@student_required
def dashboard():
    student = Student.query.get(session['user_id'])
    admin = Admin.query.first()
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'platform_name': admin.platform_name,
            'student_name': student.name
        })
    return render_template('dashboard.html', student_name=student.name)

@app.route('/dashboard/student-courses')
@student_required
def student_courses():
    student = Student.query.get(session['user_id'])
    return jsonify([{
        'id': course.id,
        'name': course.name,
        'image': course.image
    } for course in student.courses])

@app.route('/course/<int:course_id>')
@student_required
def course_view(course_id):
    return render_template('course_modules.html')

@app.route('/course/<int:course_id>/module/<int:module_id>/lesson/<int:lesson_order>')
@student_required
def module_view(course_id, module_id, lesson_order):
    course = Course.query.get_or_404(course_id)
    module = Module.query.filter_by(id=module_id, course_id=course_id).first_or_404()
    
    lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
    
    if lesson_order < 1 or lesson_order > len(lessons):
        return redirect(url_for('module_view', course_id=course_id, module_id=module_id, lesson_order=1))
    
    current_lesson = next((lesson for lesson in lessons if lesson.order == lesson_order), None)
    if not current_lesson:
        abort(404)
    
    # Formatar a descrição da lição
    formatted_description = format_description(current_lesson.description)
    
    # Buscar o documento associado à lição
    document = Document.query.filter_by(lesson_id=current_lesson.id).first()
    
    # Verificar se a lição já foi assistida pelo aluno
    student_id = session['user_id']
    lesson_completed = db.session.query(student_lessons).filter_by(
        student_id=student_id, lesson_id=current_lesson.id
    ).first() is not None
    
    return render_template('module_lessons.html', 
                           course=course,
                           module=module,
                           lessons=lessons,
                           current_lesson=current_lesson,
                           formatted_description=formatted_description,
                           document=document,
                           lesson_completed=lesson_completed,
                           has_button=current_lesson.has_button,
                           button_text=current_lesson.button_text,
                           button_link=current_lesson.button_link,
                           button_delay=current_lesson.button_delay)

@app.route('/lesson/<int:lesson_id>')
@student_required
def lesson_view(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    return render_template('module_lessons.html', lesson=lesson)

@app.route('/api/course/<int:course_id>')
@student_required
def api_get_course_details(course_id):
    course = Course.query.get_or_404(course_id)
    student = Student.query.get(session['user_id'])
    
    # Calcular o número total de aulas e aulas concluídas
    total_lessons = sum(len(module.lessons) for module in course.modules)
    completed_lessons = db.session.query(student_lessons).filter_by(student_id=student.id).join(Lesson).join(Module).filter(Module.course_id == course_id).count()
    
    return jsonify({
        'id': course.id,
        'title': course.name,
        'description': course.description,
        'instructor': 'Nome do Instrutor',  # Você precisará adicionar este campo ao modelo Course
        'totalLessons': total_lessons,
        'completedLessons': completed_lessons,
        'modules': [{
            'id': module.id,
            'title': module.name,
            'description': 'Descrição do módulo',  # Você pode adicionar este campo ao modelo Module
            'image': module.image or '/static/default-module-image.jpg',
            'lessons': [{'id': lesson.id, 'title': lesson.title} for lesson in module.lessons]
        } for module in course.modules]
    })

@app.route('/admin/all-courses', methods=['GET'])
@admin_required
def get_all_courses():
    courses = Course.query.all()
    return jsonify([{
        'id': course.id,
        'name': course.name
    } for course in courses])

@app.route('/admin/import-students')
@admin_required
@installation_required
def import_students():
    return render_template('import_students.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    # Obter o nome da plataforma do primeiro admin
    admin = Admin.query.first()
    platform_name = admin.platform_name if admin else 'MembriumWL'
    return render_template('forgot_password.html', platform_name=platform_name)

@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    email = data.get('email')
    new_password = data.get('newPassword')

    student = Student.query.filter_by(email=email).first()

    if not student:
        return jsonify({'success': False, 'message': 'Email não encontrado.'}), 404

    hashed_password = generate_password_hash(new_password)
    student.password = hashed_password
    db.session.commit()

    return jsonify({'success': True, 'message': 'Senha redefinida com sucesso!'})

@app.route('/admin/import-students', methods=['GET', 'POST'])
@admin_required
@installation_required
def import_students_csv():
    if request.method == 'POST':
        if 'csvFile' not in request.files:
            return jsonify({'success': False, 'message': 'Nenhum arquivo enviado'})
        
        file = request.files['csvFile']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'Nenhum arquivo selecionado'})
        
        if file and file.filename.endswith('.csv'):
            course_id = request.form.get('course')
            if not course_id:
                return jsonify({'success': False, 'message': 'Nenhum curso selecionado'})
            
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'success': False, 'message': 'Curso não encontrado'})
            
            # Ler o conteúdo do arquivo antes de fechá-lo
            file_content = file.read().decode("UTF8")
            
            def generate():
                stream = io.StringIO(file_content)
                csv_reader = csv.DictReader(stream)
                
                total_students = sum(1 for row in csv_reader)
                stream.seek(0)
                csv_reader = csv.DictReader(stream)
                
                imported_students = 0
                
                for row in csv_reader:
                    name = row.get('name')
                    email = row.get('email')
                    phone = row.get('phone', '')  # Get phone from CSV if available
                    
                    if not name or not email:
                        continue
                    
                    student = Student.query.filter_by(email=email).first()
                    if student:
                        if course not in student.courses:
                            student.courses.append(course)
                            imported_students += 1
                    else:
                        new_student = Student(name=name, email=email, phone=phone, password=generate_password_hash('senha123'))
                        new_student.courses.append(course)
                        db.session.add(new_student)
                        imported_students += 1
                    
                    db.session.commit()
                    
                    yield json.dumps({
                        'progress': {
                            'imported': imported_students,
                            'total': total_students
                        }
                    }) + '\n'
                
                yield json.dumps({
                    'success': True,
                    'message': f'{imported_students} alunos importados com sucesso',
                    'imported': imported_students,
                    'total': total_students
                })
            
            return Response(stream_with_context(generate()), mimetype='application/json')
        
        return jsonify({'success': False, 'message': 'Arquivo inválido'})
    
    return render_template('import_students.html')

@app.route('/mark_lesson_completed', methods=['POST'])
@student_required
def mark_lesson_completed():
    data = request.json
    lesson_id = data.get('lesson_id')
    student_id = session['user_id']

    if not lesson_id:
        return jsonify({'success': False, 'message': 'Lesson ID is required'}), 400

    # Verifica se já existe um registro para esta lição e este aluno
    existing_record = db.session.query(student_lessons).filter_by(
        student_id=student_id, lesson_id=lesson_id
    ).first()

    if existing_record:
        return jsonify({'success': True, 'message': 'Lesson already marked as completed'})

    # Adiciona um novo registro na tabela student_lessons
    new_record = student_lessons.insert().values(student_id=student_id, lesson_id=lesson_id)
    db.session.execute(new_record)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Lesson marked as completed'})

@app.route('/admin/upload_cover', methods=['POST'])
@admin_required
def upload_cover():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Nenhum arquivo enviado'})
    file = request.files['file']
    course_id = request.form.get('course_id')
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Nenhum arquivo selecionado'})
    if file:
        filename = secure_filename(f"cover_{course_id}.jpg")
        file.save(os.path.join('static/uploads', filename))
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Upload falhou'})

@app.route('/admin/lesson/<int:lesson_id>/files', methods=['GET'])
@admin_required
def get_lesson_files(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    files = [{'id': doc.id, 'filename': doc.filename} for doc in lesson.documents]
    return jsonify(files)

@app.route('/admin/lesson/<int:lesson_id>/file/<int:file_id>', methods=['DELETE'])
@admin_required
def delete_lesson_file(lesson_id, file_id):
    document = Document.query.get_or_404(file_id)
    
    # Verificar se o arquivo pertence à aula
    if document.lesson_id != lesson_id:
        return jsonify({'success': False, 'message': 'Arquivo não pertence a esta aula'}), 403
    
    try:
        # Remover arquivo físico
        os.remove(os.path.join('static/uploads', document.filename))
        
        # Remover registro do banco de dados
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/file-manager')
@admin_required
@installation_required
def file_manager():
    # Renderiza a página do gerenciador de arquivos
    return render_template('file_manager.html')

@app.route('/admin/files', methods=['GET'])
@admin_required
def get_files():
    # Parâmetros de paginação e filtro
    page = request.args.get('page', 1, type=int)
    per_page = 12  # 12 arquivos por página (3 linhas de 4 colunas)
    file_type = request.args.get('fileType', 'all')
    status = request.args.get('status', 'all')
    search = request.args.get('search', '')
    
    # Listar todos os arquivos físicos na pasta uploads
    uploads_dir = os.path.join('static', 'uploads')
    physical_files = []
    
    try:
        physical_files = os.listdir(uploads_dir)
    except Exception as e:
        return jsonify({
            'files': [],
            'totalPages': 0,
            'currentPage': page,
            'stats': {'totalFiles': 0, 'unusedFiles': 0, 'totalSize': 0}
        })
    
    # Obter todos os documentos no banco de dados
    db_files = Document.query.all()
    db_filenames = {doc.filename: doc for doc in db_files}
    
    # Obter todas as imagens de curso em uso
    course_images = {course.image for course in Course.query.filter(Course.image.isnot(None)).all()}
    
    # Obter todos os IDs de curso para verificar capas
    course_ids = {course.id for course in Course.query.all()}
    
    # Obter todas as imagens de módulo em uso
    module_images = {module.image for module in Module.query.filter(Module.image.isnot(None)).all()}
    
    # NOVO: Obter entradas de vitrine e promoções de imagem
    showcase_entries = Showcase.query.filter(Showcase.image.isnot(None)).all()
    promo_entries = Promotion.query.filter(Promotion.media_type=='image').all()
    
    # Preparar a lista de arquivos
    all_files = []
    for filename in physical_files:
        file_path = os.path.join(uploads_dir, filename)
        
        # Verificar se é um arquivo (não uma pasta)
        if not os.path.isfile(file_path):
            continue
        
        # Verificar filtro de tipo
        is_image = bool(re.search(r'\.(jpg|jpeg|png|gif|webp)$', filename, re.IGNORECASE))
        is_document = bool(re.search(r'\.(pdf|doc|docx|xls|xlsx|csv|txt)$', filename, re.IGNORECASE))
        
        if file_type == 'image' and not is_image:
            continue
        elif file_type == 'document' and not is_document:
            continue
        
        # Verificar a busca
        if search and search.lower() not in filename.lower():
            continue
        
        # Determinar se o arquivo está em uso com base em seu tipo
        is_used = False
        used_in = []

        # 1. Verificar se é uma imagem de capa (cover_*.jpg)
        cover_match = re.match(r'^cover_(\d+)\.jpg$', filename)
        if cover_match:
            course_id = int(cover_match.group(1))
            if course_id in course_ids:
                is_used = True
                course = Course.query.get(course_id)
                if course:
                    used_in.append(f"Capa do Curso: {course.name}")

        # 2. Verificar se é uma imagem de curso (course_*.jpg)
        elif filename in course_images:
            is_used = True
            # Encontrar o curso que usa esta imagem
            for course in Course.query.filter_by(image=filename).all():
                used_in.append(f"Imagem do Curso: {course.name}")
        
        # 3. Verificar se é uma imagem de módulo (module_*.jpg)
        elif filename in module_images:
            is_used = True
            # Encontrar o módulo que usa esta imagem
            for module in Module.query.filter_by(image=filename).all():
                course = Course.query.get(module.course_id) if module.course_id else None
                course_name = course.name if course else "Curso desconhecido"
                used_in.append(f"Imagem do Módulo: {module.name} no curso {course_name}")
        
        # 4. Verificar se é um documento associado a uma aula
        elif filename in db_filenames:
            db_doc = db_filenames[filename]
            if db_doc.lesson_id is not None:
                lesson = Lesson.query.get(db_doc.lesson_id)
                if lesson:  # Verificar se a aula ainda existe
                    is_used = True
                    # Buscar informações da aula e do módulo
                    module = Module.query.get(lesson.module_id) if lesson.module_id else None
                    if module:
                        course = Course.query.get(module.course_id) if module.course_id else None
                        course_name = course.name if course else "Curso desconhecido"
                        used_in.append(f"Documento da Aula: {lesson.title}, Módulo: {module.name}, Curso: {course_name}")
                    else:
                        used_in.append(f"Documento da Aula: {lesson.title}")

        # NOVO: Verificar se é imagem de vitrine (showcase)
        for item in showcase_entries:
            if filename == item.image and os.path.exists(file_path):
                is_used = True
                used_in.append(f"Imagem da Vitrine: {item.name}")
                break

        # NOVO: Verificar se é imagem de promoção (promotion)
        for promo in promo_entries:
            if filename == promo.media_url and os.path.exists(file_path):
                is_used = True
                used_in.append(f"Imagem da Promoção: {promo.title}")
                break

        # Verificar filtro de status
        if status == 'used' and not is_used:
            continue
        elif status == 'unused' and is_used:
            continue
        
        # Obter o tamanho do arquivo
        try:
            size = os.path.getsize(file_path)
        except:
            size = 0
        
        # Obter data de upload (data de criação do arquivo)
        try:
            upload_date = datetime.fromtimestamp(os.path.getctime(file_path))
        except:
            upload_date = datetime.now()
        
        # Criar entrada para o arquivo
        all_files.append({
            'id': db_filenames[filename].id if filename in db_filenames else -1,
            'filename': filename,
            'is_used': is_used,
            'used_in': used_in,
            'size': size,
            'upload_date': upload_date.strftime('%Y-%m-%d')
        })
    
    # Ordenar por data de upload (mais recentes primeiro)
    all_files.sort(key=lambda x: x['upload_date'], reverse=True)
    
    # Paginação manual
    total_files = len(all_files)
    total_pages = (total_files + per_page - 1) // per_page  # Ceiling division
    start_idx = (page - 1) * per_page
    end_idx = min(start_idx + per_page, total_files)
    paginated_files = all_files[start_idx:end_idx]
    
    # Contar arquivos não utilizados
    unused_files = sum(1 for file in all_files if not file['is_used'])
    
    # Calcular o espaço total utilizado
    total_size = sum(file['size'] for file in all_files)
    
    stats = {
        'totalFiles': total_files,
        'unusedFiles': unused_files,
        'totalSize': total_size
    }
    
    return jsonify({
        'files': paginated_files,
        'totalPages': total_pages,
        'currentPage': page,
        'stats': stats
    })

@app.route('/admin/files/<path:file_id>', methods=['DELETE'])
@admin_required
def delete_file(file_id):
    try:
        # Verificar se é um ID válido do banco de dados ou um ID negativo
        if file_id == '-1':
            # Caso especial: arquivo está no sistema de arquivos, mas não no banco de dados
            filename = request.args.get('filename')
            if not filename:
                return jsonify({
                    'success': False, 
                    'message': 'Nome do arquivo é necessário para arquivos que não estão no banco de dados'
                }), 400
                
            file_path = os.path.join('static/uploads', filename)
            
            # Verificar se o arquivo está sendo usado antes de excluí-lo
            is_used = False
            
            # 1. Verificar se é uma imagem de capa
            cover_match = re.match(r'^cover_(\d+)\.jpg$', filename)
            if cover_match:
                course_id = int(cover_match.group(1))
                if Course.query.get(course_id):
                    is_used = True
            
            # 2. Verificar se é uma imagem de curso
            if not is_used and Course.query.filter_by(image=filename).first():
                is_used = True
            
            # 3. Verificar se é uma imagem de módulo
            if not is_used and Module.query.filter_by(image=filename).first():
                is_used = True
            
            if is_used:
                return jsonify({
                    'success': False, 
                    'message': 'Não é possível excluir um arquivo que está em uso.'
                }), 403
                
            try:
                # Verificar se o arquivo existe
                if not os.path.exists(file_path):
                    return jsonify({
                        'success': False, 
                        'message': 'Arquivo não encontrado'
                    }), 404
                    
                # Remover arquivo físico
                os.remove(file_path)
                return jsonify({'success': True, 'message': 'Arquivo excluído com sucesso.'})
                
            except Exception as e:
                return jsonify({'success': False, 'message': str(e)}), 500
        else:
            # Converter para inteiro para IDs positivos (banco de dados)
            file_id = int(file_id)
            # Caso normal: arquivo está no banco de dados
            doc = Document.query.get_or_404(file_id)
            filename = doc.filename
            file_path = os.path.join('static/uploads', filename)
            
            # Verificar se o arquivo está sendo usado (documento associado a aula)
            if doc.lesson_id is not None and Lesson.query.get(doc.lesson_id):
                return jsonify({
                    'success': False, 
                    'message': 'Não é possível excluir um arquivo que está em uso. Remova-o da aula primeiro.'
                }), 403
            
            try:
                # Remover arquivo físico se existir
                if os.path.exists(file_path):
                    os.remove(file_path)
                
                # Remover registro do banco de dados
                db.session.delete(doc)
                db.session.commit()
                
                return jsonify({'success': True, 'message': 'Arquivo excluído com sucesso.'})
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 500
    except Exception as e:
        return jsonify({'success': False, 'message': f'Erro inesperado: {str(e)}'}), 500

@app.route('/admin/settings')
@admin_required
@installation_required
def settings():
    # Verificar se o usuário atual é realmente um administrador
    current_user_id = session.get('user_id')
    current_user = Admin.query.get(current_user_id)
    
    if not current_user:
        abort(403)  # Forbidden

    # Obter as configurações atuais ou criar se não existirem
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
        db.session.commit()
        
    return render_template('settings.html', settings=settings, admin_email=current_user.email)

@app.route('/api/settings', methods=['GET'])
@admin_required
def get_settings():
    settings = Settings.query.first()
    admin = Admin.query.first()
    
    if not settings:
        settings = Settings()
        db.session.add(settings)
        db.session.commit()
    
    return jsonify({
        'platform_name': admin.platform_name,
        'admin_email': admin.email,
        'support_email': settings.support_email,
        'brevo': {
            'enabled': settings.brevo_enabled,
            'api_key': settings.brevo_api_key,
            'email_subject': settings.brevo_email_subject,
            'email_template': settings.brevo_email_template,
            'sender_name': settings.sender_name,
            'sender_email': settings.sender_email
        },
        'evolution': {
            'enabled': settings.evolution_enabled,
            'url': settings.evolution_url,
            'api_key': settings.evolution_api_key,
            'message_template': settings.evolution_message_template,
            'version': settings.evolution_version,
            'instance': settings.evolution_instance
        },
        'groq': {
            'enabled': settings.groq_api_enabled,
            'api_key': settings.groq_api
        },
        'openai': {
            'enabled': settings.openai_api_enabled,
            'api_key': settings.openai_api
        }
    })

@app.route('/api/settings/platform', methods=['POST'])
@admin_required
def update_platform_settings():
    data = request.form
    platform_name = data.get('platform_name')
    
    if not platform_name:
        return jsonify({'success': False, 'message': 'Nome da plataforma é obrigatório'}), 400
    
    admin = Admin.query.first()
    if admin:
        admin.platform_name = platform_name
        db.session.commit()
        return jsonify({'success': True, 'message': 'Nome da plataforma atualizado com sucesso'})
    else:
        return jsonify({'success': False, 'message': 'Administrador não encontrado'}), 404

@app.route('/api/settings/support', methods=['POST'])
@admin_required
def update_support_email():
    data = request.form
    support_email = data.get('support_email')
    
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    
    settings.support_email = support_email
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Email de suporte atualizado com sucesso'})

@app.route('/api/settings/brevo', methods=['POST'])
@admin_required
def update_brevo_settings():
    data = request.form
    enabled = data.get('enabled', 'false').lower() == 'true'
    api_key = data.get('api_key')
    email_subject = data.get('email_subject')
    email_template = data.get('email_template')
    sender_name = data.get('sender_name')
    sender_email = data.get('sender_email')
    
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    
    settings.brevo_enabled = enabled
    
    if enabled and not api_key:
        return jsonify({'success': False, 'message': 'API Key é obrigatória quando a integração está ativa'}), 400
    
    if enabled:
        settings.brevo_api_key = api_key
        settings.brevo_email_subject = email_subject
        settings.brevo_email_template = email_template
        settings.sender_name = sender_name
        settings.sender_email = sender_email
    else:
        # When disabled, clear out the settings
        settings.brevo_api_key = None
        # Preserve the template and other settings for when the integration is re-enabled
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Configurações da Brevo atualizadas com sucesso'})

@app.route('/api/settings/evolution', methods=['POST'])
@admin_required
def update_evolution_settings():
    data = request.form
    enabled = data.get('enabled', 'false').lower() == 'true'
    url = data.get('url')
    api_key = data.get('api_key')
    message_template = data.get('message_template')
    version = data.get('version')  # New field for API version
    instance = data.get('instance')  # New field for WhatsApp instance
    
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    
    settings.evolution_enabled = enabled
    
    if enabled:
        if not url:
            return jsonify({'success': False, 'message': 'URL é obrigatória quando a integração está ativada'}), 400
        if not api_key:
            return jsonify({'success': False, 'message': 'API Key é obrigatória quando a integração está ativada'}), 400
        if not version:
            return jsonify({'success': False, 'message': 'Versão da API é obrigatória quando a integração está ativada'}), 400
        if not instance:
            return jsonify({'success': False, 'message': 'Instância do WhatsApp é obrigatória quando a integração está ativada'}), 400
        
        settings.evolution_url = url
        settings.evolution_api_key = api_key
        settings.evolution_message_template = message_template
        settings.evolution_version = version  # Save the API version
        settings.evolution_instance = instance  # Save the WhatsApp instance
    else:
        # When disabled, clear out the settings
        settings.evolution_api_key = None
        # Preserve the template and other settings for when the integration is re-enabled
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Configurações da Evolution API atualizadas com sucesso'})

@app.route('/api/settings/groq', methods=['POST'])
@admin_required
def update_groq_settings():
    data = request.form
    enabled = data.get('enabled', 'false').lower() == 'true'
    api_key = data.get('api_key')
    
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    
    settings.groq_api_enabled = enabled
    # Se estiver ativado, salva a chave; senão, limpa a chave
    if enabled:
        settings.groq_api = api_key
    else:
        settings.groq_api = None
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Configurações da GROQ AI atualizadas com sucesso'})

@app.route('/api/settings/openai', methods=['POST'])
@admin_required
def update_openai_settings():
    data = request.form
    enabled = data.get('enabled', 'false').lower() == 'true'
    api_key = data.get('api_key')
    
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    
    settings.openai_api_enabled = enabled
    # Se estiver ativado, salva a chave; senão, limpa a chave
    if enabled:
        settings.openai_api = api_key
    else:
        settings.openai_api = None
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Configurações da OpenAI atualizadas com sucesso'})

@app.route('/api/settings/admin', methods=['POST'])
@admin_required
def update_admin_settings():
    data = request.form
    email = data.get('email')
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    admin = Admin.query.first()
    
    if not admin:
        return jsonify({'success': False, 'message': 'Administrador não encontrado'}), 404
    
    # Atualizar email se fornecido
    if email and email != admin.email:
        admin.email = email
    
    # Atualizar senha se fornecida
    if current_password and new_password:
        if check_password_hash(admin.password, current_password):
            admin.password = generate_password_hash(new_password)
        else:
            return jsonify({'success': False, 'message': 'Senha atual incorreta'}), 400
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Informações do administrador atualizadas com sucesso'})

@app.route('/access/<uuid>')
def quick_access(uuid):
    student = Student.query.filter_by(uuid=uuid).first()
    if not student:
        flash('Link de acesso inválido', 'error')
        return redirect(url_for('login'))
    
    session['user_id'] = student.id
    session['user_type'] = 'student'
    return redirect(url_for('dashboard'))

@app.route('/my_profile')
@student_required
def my_profile():
    # Get the student data
    student = Student.query.get(session['user_id'])
    admin = Admin.query.first()
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'platform_name': admin.platform_name,
            'student_name': student.name,
            'student_email': student.email
        })
    
    return render_template('my_profile.html')

@app.route('/update_password', methods=['POST'])
@student_required
def update_password():
    data = request.json
    new_password = data.get('new_password')
    
    if not new_password:
        return jsonify({'success': False, 'message': 'Nova senha não fornecida'})
    
    student = Student.query.get(session['user_id'])
    student.set_password(new_password)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Senha atualizada com sucesso!'})

@app.route('/admin/promote')
@admin_required
@installation_required
def promote_panel():
    current_user_id = session.get('user_id')
    current_user = Admin.query.get(current_user_id)
    
    if not current_user:
        return redirect(url_for('login'))

    return render_template('promote.html')

@app.route('/admin/showcase')
@admin_required
@installation_required
def showcase_panel():
    # Verify the current user is an administrator
    current_user_id = session.get('user_id')
    current_user = Admin.query.get(current_user_id)
    
    if not current_user:
        return redirect(url_for('login'))

    return render_template('showcase.html')

# API endpoint para obter promoções ativas
@app.route('/api/active-promotions')
@student_required
def get_active_promotions():
    now = datetime.utcnow()
    active_promotions = Promotion.query.filter(
        Promotion.is_active == True,
        Promotion.start_date <= now,
        Promotion.end_date >= now
    ).all()
    
    return jsonify({
        'success': True,
        'promotions': [{
            'id': promo.id,
            'title': promo.title,
            'description': promo.description,
            'media_type': promo.media_type,
            'media_url': promo.media_url,
            'has_cta': promo.has_cta,
            'cta_text': promo.cta_text,
            'cta_url': promo.cta_url,
            'button_delay': promo.button_delay,
            'hide_video_controls': promo.hide_video_controls
        } for promo in active_promotions]
    })

# API endpoint para obter cursos em destaque (showcase)
@app.route('/api/showcase-courses')
@student_required
def get_showcase_courses():
    # Obter todos os cursos ativos na vitrine
    active_showcase = Showcase.query.filter_by(status='active').all()
    
    return jsonify({
        'success': True,
        'courses': [{
            'id': item.id,
            'course_id': item.course_id,  # Add course_id to response
            'name': item.name,
            'description': item.description,
            'image': item.image,
            'button_text': item.button_text,
            'button_link': item.button_link,
            'price': item.price,
            'has_video': item.has_video,
            'video_url': item.video_url,
            'priority': item.priority,
            'button_delay': item.button_delay
        } for item in active_showcase]
    })

# Add this new API endpoint after your other showcase endpoints
@app.route('/api/showcase/analytics')
def get_showcase_analytics():
    try:
        # Parse query parameters
        showcase_id = request.args.get('showcase_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Convert string dates to datetime
        from datetime import datetime, timedelta
        
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        else:
            # Default to 30 days ago
            start_date = (datetime.now() - timedelta(days=30)).date()
            
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        else:
            end_date = datetime.now().date()
        
        # Build the query for showcase analytics
        query = db.session.query(
            ShowcaseAnalytics.date,
            db.func.sum(ShowcaseAnalytics.views).label('views'),
            db.func.sum(ShowcaseAnalytics.conversions).label('conversions')
        )
        
        # Apply showcase filter if specified
        if showcase_id and showcase_id != 'all':
            query = query.filter(ShowcaseAnalytics.showcase_id == showcase_id)
        
        # Apply date range filter
        query = query.filter(
            ShowcaseAnalytics.date >= start_date,
            ShowcaseAnalytics.date <= end_date
        )
        
        # Group by date and order by date
        daily_data = query.group_by(ShowcaseAnalytics.date).order_by(ShowcaseAnalytics.date).all()
        
        # Calculate totals
        total_views = sum(day.views for day in daily_data)
        total_clicks = sum(day.conversions for day in daily_data)
        
        # Format dates for the frontend
        formatted_data = [
            {
                'date': day.date.strftime('%d/%m'),
                'views': day.views,
                'conversions': day.conversions
            } 
            for day in daily_data
        ]
        
        return jsonify({
            'success': True,
            'totalViews': total_views,
            'totalClicks': total_clicks,
            'dailyData': formatted_data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# Add this new endpoint for total showcase analytics (all time)
@app.route('/api/showcase/analytics/total')
@admin_required
def get_total_showcase_analytics():
    try:
        # Query total views and conversions across all showcases and all time
        totals = db.session.query(
            db.func.sum(ShowcaseAnalytics.views).label('views'),
            db.func.sum(ShowcaseAnalytics.conversions).label('conversions')
        ).first()
        
        # Handle None values
        total_views = totals.views or 0
        total_clicks = totals.conversions or 0
        
        return jsonify({
            'success': True,
            'totalViews': total_views,
            'totalClicks': total_clicks
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/admin/cover', methods=['DELETE'])
@admin_required
def delete_cover():
    course_id = request.args.get('course_id')
    if not course_id:
        return jsonify({'success': False, 'message': 'Course ID não fornecido'}), 400
    
    filename = f"cover_{course_id}.jpg"
    file_path = os.path.join('static/uploads', filename)
    
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return jsonify({'success': True, 'message': 'Cover excluído com sucesso!'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    else:
        # Se o arquivo não existir, retorna sucesso informando que já não há cover
        return jsonify({'success': True, 'message': 'Nenhum cover para excluir'}), 200

# Add this new route to get support email
@app.route('/api/support-email')
def get_support_email():
    settings = Settings.query.first()
    if settings and settings.support_email:
        return jsonify({
            'success': True,
            'support_email': settings.support_email
        })
    return jsonify({
        'success': False,
        'support_email': None
    })

@app.route('/dashboard/student-progress')
@student_required
def get_student_progress():
    student_id = session['user_id']
    student = Student.query.get(student_id)

    # Get all courses the student is enrolled in
    student_course_ids = [course.id for course in student.courses]
    
    # Get all modules for these courses
    modules = Module.query.filter(Module.course_id.in_(student_course_ids)).all()
    module_ids = [module.id for module in modules]
    
    # Get total lessons count
    total_lessons = Lesson.query.filter(Lesson.module_id.in_(module_ids)).count()
    
    # Get completed lessons count
    completed_lessons = db.session.query(student_lessons)\
        .join(Lesson)\
        .filter(student_lessons.c.student_id == student_id)\
        .filter(Lesson.module_id.in_(module_ids))\
        .count()
    
    # Calculate progress percentage
    progress_percentage = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
    
    return jsonify({
        'total_lessons': total_lessons,
        'completed_lessons': completed_lessons,
        'progress_percentage': round(progress_percentage, 1)
    })

@app.route('/api/course/<int:course_id>/progress')
@student_required
def get_course_progress(course_id):
    student = Student.query.get(session['user_id'])
    course = Course.query.get_or_404(course_id)
    
    # Get all lessons in this course's modules
    total_lessons = db.session.query(Lesson)\
        .join(Module)\
        .filter(Module.course_id == course_id)\
        .count()
    
    # Get completed lessons for this course
    completed_lessons = db.session.query(student_lessons)\
        .join(Lesson)\
        .join(Module)\
        .filter(Module.course_id == course_id)\
        .filter(student_lessons.c.student_id == student.id)\
        .count()
    
    progress_percentage = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
    
    return jsonify({
        'course_id': course_id,
        'total_lessons': total_lessons,
        'completed_lessons': completed_lessons,
        'progress_percentage': round(progress_percentage, 1)
    })

# Register blueprints
from webhook import webhook
app.register_blueprint(webhook)
app.register_blueprint(promote)
app.register_blueprint(showcase)  # Register the showcase blueprint
app.register_blueprint(faq)  # Register the FAQ blueprint
app.register_blueprint(faq_ai)  # Register the FAQ AI blueprint
app.register_blueprint(chatbot)  # Register the chatbot blueprint

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', debug=True, port=3000)