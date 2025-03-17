from flask import Blueprint, render_template, request, jsonify, session, abort
from functools import wraps
from models import db, Course, Module, Lesson, FAQ
from sqlalchemy import func, distinct
from sqlalchemy.orm import aliased

faq = Blueprint('faq', __name__)

# Admin decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_type' not in session or session['user_type'] != 'admin':
            return abort(403)
        return f(*args, **kwargs)
    return decorated_function

# Render FAQ management page
@faq.route('/admin/faq')
@admin_required
def faq_panel():
    return render_template('faq.html')

# Get all lessons with FAQs, grouped by lesson (one entry per lesson)
@faq.route('/api/faqs', methods=['GET'])
@admin_required
def get_faqs():
    page = request.args.get('page', 1, type=int)
    per_page = 10
    course_filter = request.args.get('course', '')
    module_filter = request.args.get('module', '')
    search = request.args.get('search', '')
    
    # Base query to get unique lessons with FAQs and their counts
    lesson_alias = aliased(Lesson)
    query = db.session.query(
        lesson_alias.id.label('lesson_id'),
        lesson_alias.title.label('lesson_title'),
        Module.name.label('module_name'),
        Module.id.label('module_id'),
        Course.name.label('course_name'),
        Course.id.label('course_id'),
        func.count(FAQ.id).label('faq_count')
    ).join(
        FAQ, FAQ.lesson_id == lesson_alias.id
    ).join(
        Module, lesson_alias.module_id == Module.id
    ).join(
        Course, Module.course_id == Course.id
    ).group_by(
        lesson_alias.id, lesson_alias.title, Module.name, Module.id, Course.name, Course.id
    )
    
    # Apply filters
    if course_filter:
        query = query.filter(Module.course_id == course_filter)
    if module_filter:
        query = query.filter(lesson_alias.module_id == module_filter)
    if search:
        query = query.filter(
            (lesson_alias.title.ilike(f'%{search}%')) |
            (Module.name.ilike(f'%{search}%')) |
            (Course.name.ilike(f'%{search}%'))
        )
    
    # Get total count before pagination
    total = query.count()
    
    # Order by course, module, lesson
    query = query.order_by(Course.name, Module.name, lesson_alias.title)
    
    # Paginate results
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Format results
    lesson_faqs = []
    for item in paginated.items:
        lesson_faqs.append({
            'lesson_id': item.lesson_id,
            'lesson_title': item.lesson_title,
            'module_name': item.module_name,
            'module_id': item.module_id,
            'course_name': item.course_name,
            'course_id': item.course_id,
            'faq_count': item.faq_count
        })
    
    return jsonify({
        'faqs': lesson_faqs,
        'total': total,
        'pages': paginated.pages,
        'current_page': page
    })

# Check if lesson already has FAQs
@faq.route('/api/faq/lesson-has-faq/<int:lesson_id>', methods=['GET'])
@admin_required
def check_lesson_has_faq(lesson_id):
    count = FAQ.query.filter_by(lesson_id=lesson_id).count()
    return jsonify({'has_faq': count > 0})

# Get all courses for dropdown selection
@faq.route('/api/faq/courses', methods=['GET'])
@admin_required
def get_courses():
    courses = Course.query.order_by(Course.name).all()
    return jsonify([{'id': c.id, 'name': c.name} for c in courses])

# Get modules for a specific course
@faq.route('/api/faq/course/<int:course_id>/modules', methods=['GET'])
@admin_required
def get_course_modules(course_id):
    modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
    return jsonify([{'id': m.id, 'name': m.name, 'order': m.order} for m in modules])

# Get lessons for a specific module
@faq.route('/api/faq/module/<int:module_id>/lessons', methods=['GET'])
@admin_required
def get_module_lessons(module_id):
    # Create subquery to get lessons that already have FAQs
    lessons_with_faq = db.session.query(FAQ.lesson_id).distinct().subquery()
    
    lessons = Lesson.query.outerjoin(
        lessons_with_faq, Lesson.id == lessons_with_faq.c.lesson_id
    ).filter(
        Lesson.module_id == module_id,
        lessons_with_faq.c.lesson_id.is_(None)  # Only include lessons without FAQs
    ).order_by(Lesson.order).all()
    
    return jsonify([{'id': l.id, 'title': l.title, 'order': l.order} for l in lessons])

# Get FAQs for a specific lesson
@faq.route('/api/faq/lesson/<int:lesson_id>', methods=['GET'])
def get_lesson_faqs(lesson_id):
    if 'user_id' not in session:
        return abort(401)  # Unauthorized if not logged in
        
    faqs = FAQ.query.filter_by(lesson_id=lesson_id).order_by(FAQ.order).all()
    return jsonify([{
        'id': f.id,
        'lesson_id': f.lesson_id,
        'question': f.question,
        'answer': f.answer,
        'order': f.order
    } for f in faqs])

# Create FAQs for a lesson
@faq.route('/api/faq/create', methods=['POST'])
@admin_required
def create_faq():
    data = request.json
    lesson_id = data.get('lesson_id')
    faqs_data = data.get('faqs')
    
    if not lesson_id or not faqs_data:
        return jsonify({'success': False, 'message': 'Dados inválidos'})
    
    # Check if lesson already has FAQs
    existing_faqs = FAQ.query.filter_by(lesson_id=lesson_id).count()
    if existing_faqs > 0:
        return jsonify({'success': False, 'message': 'Esta aula já possui FAQs. Edite os FAQs existentes em vez de criar novos.'})
    
    # Insert new FAQs
    for index, faq_item in enumerate(faqs_data):
        faq = FAQ(
            lesson_id=lesson_id,
            question=faq_item['question'],
            answer=faq_item['answer'],
            order=index + 1
        )
        db.session.add(faq)
    
    try:
        db.session.commit()
        return jsonify({'success': True, 'message': 'FAQs salvos com sucesso'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Erro ao salvar FAQs: {str(e)}'})

# Update FAQ
@faq.route('/api/faq/update/<int:lesson_id>', methods=['PUT'])
@admin_required
def update_lesson_faqs(lesson_id):
    data = request.json
    faqs_data = data.get('faqs')
    
    if not faqs_data:
        return jsonify({'success': False, 'message': 'Dados inválidos'})
    
    # Delete existing FAQs for this lesson
    FAQ.query.filter_by(lesson_id=lesson_id).delete()
    
    # Insert updated FAQs
    for index, faq_item in enumerate(faqs_data):
        faq = FAQ(
            lesson_id=lesson_id,
            question=faq_item['question'],
            answer=faq_item['answer'],
            order=index + 1
        )
        db.session.add(faq)
    
    try:
        db.session.commit()
        return jsonify({'success': True, 'message': 'FAQs atualizados com sucesso'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Erro ao atualizar FAQs: {str(e)}'})

# Delete all FAQs for a lesson
@faq.route('/api/faq/lesson/<int:lesson_id>', methods=['DELETE'])
@admin_required
def delete_lesson_faqs(lesson_id):
    try:
        FAQ.query.filter_by(lesson_id=lesson_id).delete()
        db.session.commit()
        return jsonify({'success': True, 'message': 'FAQs excluídos com sucesso'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Erro ao excluir FAQs: {str(e)}'})

# Delete a single FAQ
@faq.route('/api/faq/<int:faq_id>', methods=['DELETE'])
@admin_required
def delete_faq(faq_id):
    faq_item = FAQ.query.get_or_404(faq_id)
    
    try:
        db.session.delete(faq_item)
        db.session.commit()
        return jsonify({'success': True, 'message': 'FAQ excluído com sucesso'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Erro ao excluir FAQ: {str(e)}'})

# Get lesson information
@faq.route('/api/faq/lesson-info/<int:lesson_id>', methods=['GET'])
@admin_required
def get_lesson_info(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    module = Module.query.get_or_404(lesson.module_id)
    course = Course.query.get_or_404(module.course_id)
    
    return jsonify({
        'lesson': {
            'id': lesson.id,
            'title': lesson.title,
            'order': lesson.order
        },
        'module': {
            'id': module.id,
            'name': module.name,
            'order': module.order
        },
        'course': {
            'id': course.id,
            'name': course.name
        }
    })

# Get total counts for statistics
@faq.route('/api/faq/stats', methods=['GET'])
@admin_required
def get_faq_stats():
    # Total FAQs
    total_faqs = FAQ.query.count()
    
    # Count of lessons with FAQs
    lessons_with_faqs = db.session.query(FAQ.lesson_id).distinct().count()
    
    return jsonify({
        'total_faqs': total_faqs,
        'lessons_with_faqs': lessons_with_faqs
    })