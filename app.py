from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os
from datetime import datetime
from models import db, Course, Admin, Student, Module, Lesson, Document, student_courses, student_lessons
from sqlalchemy import func
from utils import format_description

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:Extreme123@5.161.76.86:5432/wldigital'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Decoradores
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
def index():
    if Admin.query.first():
        return redirect(url_for('login'))
    return redirect(url_for('install'))

@app.route('/install', methods=['GET', 'POST'])
def install():
    if Admin.query.first():
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        platform_name = request.form['platform_name']
        email = request.form['email']
        password = request.form['password']
        
        hashed_password = generate_password_hash(password)
        new_admin = Admin(email=email, password=hashed_password, platform_name=platform_name)
        
        db.create_all()
        db.session.add(new_admin)
        db.session.commit()
        
        flash('Instalação concluída com sucesso!', 'success')
        return redirect(url_for('login'))
    
    return render_template('installation.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
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
    
    return render_template('login.html')

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
def get_courses():
    courses = Course.query.all()
    return jsonify([{
        'id': course.id,
        'name': course.name,
        'description': course.description,
        'image_url': url_for('static', filename=f'uploads/{course.image}') if course.image else None
    } for course in courses])

@app.route('/admin')
@admin_required
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
    students = Student.query.all()
    return jsonify([{
        'id': student.id,
        'name': student.name,
        'email': student.email,
        'courses': [{'id': course.id, 'name': course.name} for course in student.courses]
    } for student in students])

@app.route('/admin/student', methods=['POST'])
@admin_required
def create_student():
    email = request.form['email']
    password = request.form['password']
    name = request.form['name']
    course_id = request.form['courses']  # Agora esperamos apenas um ID de curso
    
    # Criar o hash da senha
    hashed_password = generate_password_hash(password)
    
    try:
        # Criar novo estudante
        new_student = Student(email=email, password=hashed_password, name=name)
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
                'order': lesson.order
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
    
    new_lesson = Lesson(title=title, description=description, video_url=video_url, video_type=video_type, module=module, order=len(module.lessons) + 1)
    db.session.add(new_lesson)
    
    documents = request.files.getlist('documents')
    for doc in documents:
        if doc:
            filename = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{doc.filename}"
            doc.save(os.path.join('static/uploads', filename))
            new_document = Document(filename=filename, lesson=new_lesson)
            db.session.add(new_document)
    
    db.session.commit()
    return jsonify({'success': True, 'lesson': {
        'id': new_lesson.id,
        'title': new_lesson.title,
        'description': new_lesson.description,
        'video_url': new_lesson.video_url,
        'video_type': new_lesson.video_type,
        'order': new_lesson.order
    }})

@app.route('/admin/lesson/<int:lesson_id>', methods=['PUT'])
@admin_required
def update_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    lesson.title = request.form['title']
    lesson.description = request.form['description']
    lesson.video_url = request.form['video_url']
    
    documents = request.files.getlist('documents')
    for doc in documents:
        if doc:
            filename = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{doc.filename}"
            doc.save(os.path.join('static/uploads', filename))
            new_document = Document(filename=filename, lesson=lesson)
            db.session.add(new_document)
    
    db.session.commit()
    flash('Aula atualizada com sucesso!', 'success')
    return jsonify({'success': True})

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

@app.route('/admin/reorder_lessons', methods=['POST'])
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
            if request.form['password']:
                student.password = generate_password_hash(request.form['password'])
            
            course_id = request.form['course']
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'success': False, 'message': 'Curso não encontrado'}), 404
            
            student.courses = [course]  # Substitui todos os cursos pelo novo
        
        elif action == 'include':
            course_id = request.form['course']
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'success': False, 'message': 'Curso não encontrado'}), 404
            
            if course not in student.courses:
                student.courses.append(course)
        
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
                           lesson_completed=lesson_completed)

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

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    # Aqui você implementaria a lógica para redefinir a senha
    # Por enquanto, vamos apenas renderizar um template simples
    return render_template('forgot_password.html')

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

from webhook import webhook
app.register_blueprint(webhook)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=3000)