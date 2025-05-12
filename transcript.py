from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, abort
from models import db, Course, Module, Lesson, LessonTranscript
from sqlalchemy import func
from sqlalchemy.orm import aliased
import logging
import json
from datetime import datetime
from faq_ai import generate_transcript_metadata
import sys
from auth import admin_required

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("transcript")

transcript = Blueprint('transcript', __name__)

# Redirect from /transcript to /admin/transcript
@transcript.route('/transcript')
def transcript_redirect():
    return redirect(url_for('transcript.transcript_panel'))

# Render transcript management page
@transcript.route('/admin/transcript')
@admin_required
def transcript_panel():
    return render_template('transcript.html')

# Get all lessons with transcripts
@transcript.route('/api/transcripts', methods=['GET'])
@admin_required
def get_transcripts():
    page = request.args.get('page', 1, type=int)
    per_page = 10
    course_filter = request.args.get('course', '')
    module_filter = request.args.get('module', '')
    search = request.args.get('search', '')
    
    # Base query to get transcripts with their related data
    query = db.session.query(
        LessonTranscript.id,
        LessonTranscript.lesson_id,
        LessonTranscript.lesson_title,
        LessonTranscript.module_id,
        LessonTranscript.module_name,
        LessonTranscript.course_id,
        LessonTranscript.course_name,
        LessonTranscript.transcript_text,
        LessonTranscript.transcript_vector,
        LessonTranscript.searchable_keywords,
        LessonTranscript.created_at,
        LessonTranscript.updated_at,
        func.length(LessonTranscript.transcript_text).label('text_length'),
        func.length(LessonTranscript.searchable_keywords).label('keywords_length')
    )
    
    # Apply filters
    if course_filter:
        query = query.filter(LessonTranscript.course_id == course_filter)
    if module_filter:
        query = query.filter(LessonTranscript.module_id == module_filter)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                LessonTranscript.lesson_title.ilike(search_term),
                LessonTranscript.transcript_text.ilike(search_term),
                LessonTranscript.searchable_keywords.ilike(search_term),
                LessonTranscript.module_name.ilike(search_term),
                LessonTranscript.course_name.ilike(search_term)
            )
        )
    
    # Get total count before pagination
    total = query.count()
    
    # Order by course, module, lesson
    query = query.order_by(
        LessonTranscript.course_name,
        LessonTranscript.module_name,
        LessonTranscript.lesson_title
    )
    
    # Paginate results
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Format results
    transcripts = []
    for item in paginated.items:
        word_count = len(item.transcript_text.split()) if item.transcript_text else 0
        transcripts.append({
            'id': item.id,
            'lesson_id': item.lesson_id,
            'lesson_title': item.lesson_title,
            'module_id': item.module_id,
            'module_name': item.module_name,
            'course_id': item.course_id,
            'course_name': item.course_name,
            'text_length': item.text_length,
            'keywords_length': item.keywords_length,
            'word_count': word_count,
            'created_at': item.created_at.strftime('%d/%m/%Y %H:%M'),
            'updated_at': item.updated_at.strftime('%d/%m/%Y %H:%M') if item.updated_at else None
        })
    
    return jsonify({
        'transcripts': transcripts,
        'total': total,
        'pages': paginated.pages,
        'current_page': page
    })

# Check if lesson already has a transcript
@transcript.route('/api/transcript/lesson-has-transcript/<int:lesson_id>', methods=['GET'])
@admin_required
def check_lesson_has_transcript(lesson_id):
    count = LessonTranscript.query.filter_by(lesson_id=lesson_id).count()
    return jsonify({'has_transcript': count > 0})

# Get all courses for dropdown selection
@transcript.route('/api/transcript/courses', methods=['GET'])
@admin_required
def get_courses():
    courses = Course.query.order_by(Course.name).all()
    return jsonify([{'id': c.id, 'name': c.name} for c in courses])

# Get modules for a specific course
@transcript.route('/api/transcript/course/<int:course_id>/modules', methods=['GET'])
@admin_required
def get_course_modules(course_id):
    modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
    return jsonify([{'id': m.id, 'name': m.name} for m in modules])

# Get lessons for a specific module
@transcript.route('/api/transcript/module/<int:module_id>/lessons', methods=['GET'])
@admin_required
def get_module_lessons(module_id):
    lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
    return jsonify([{'id': l.id, 'title': l.title} for l in lessons])

# Get transcript for a specific lesson
@transcript.route('/api/transcript/lesson/<int:lesson_id>', methods=['GET'])
@admin_required
def get_lesson_transcript(lesson_id):
    transcript = LessonTranscript.query.filter_by(lesson_id=lesson_id).first()
    
    if not transcript:
        return jsonify({
            'success': False,
            'message': 'Transcrição não encontrada para esta aula'
        }), 404
    
    # Calculate word count
    word_count = len(transcript.transcript_text.split()) if transcript.transcript_text else 0
    
    return jsonify({
        'id': transcript.id,
        'lesson_id': transcript.lesson_id,
        'lesson_title': transcript.lesson_title,
        'module_id': transcript.module_id,
        'module_name': transcript.module_name,
        'course_id': transcript.course_id,
        'course_name': transcript.course_name,
        'transcript_text': transcript.transcript_text,
        'transcript_vector': transcript.transcript_vector,
        'searchable_keywords': transcript.searchable_keywords,
        'word_count': word_count,
        'created_at': transcript.created_at.strftime('%d/%m/%Y %H:%M'),
        'updated_at': transcript.updated_at.strftime('%d/%m/%Y %H:%M') if transcript.updated_at else None,
    })

# Create or update transcript for a lesson
@transcript.route('/api/transcript/create-update', methods=['POST'])
@admin_required
def create_update_transcript():
    data = request.json
    
    if not data:
        return jsonify({
            'success': False,
            'message': 'Dados não fornecidos'
        }), 400
    
    lesson_id = data.get('lesson_id')
    transcript_text = data.get('transcript_text', '')
    transcript_vector = data.get('transcript_vector', '')
    searchable_keywords = data.get('searchable_keywords', '')
    
    if not lesson_id:
        return jsonify({
            'success': False,
            'message': 'ID da aula não fornecido'
        }), 400
    
    # Get lesson info for relational data
    lesson = Lesson.query.get(lesson_id)
    if not lesson:
        return jsonify({
            'success': False,
            'message': 'Aula não encontrada'
        }), 404
    
    module = Module.query.get(lesson.module_id)
    if not module:
        return jsonify({
            'success': False,
            'message': 'Módulo não encontrado'
        }), 404
    
    course = Course.query.get(module.course_id)
    if not course:
        return jsonify({
            'success': False,
            'message': 'Curso não encontrado'
        }), 404
    
    # Check if transcript already exists
    existing_transcript = LessonTranscript.query.filter_by(lesson_id=lesson_id).first()
    
    try:
        if existing_transcript:
            # Update existing transcript
            existing_transcript.lesson_title = lesson.title
            existing_transcript.module_id = lesson.module_id
            existing_transcript.module_name = module.name
            existing_transcript.course_id = module.course_id
            existing_transcript.course_name = course.name
            existing_transcript.transcript_text = transcript_text
            existing_transcript.transcript_vector = transcript_vector
            existing_transcript.searchable_keywords = searchable_keywords
            existing_transcript.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Transcrição atualizada com sucesso',
                'id': existing_transcript.id
            })
        else:
            # Create new transcript
            new_transcript = LessonTranscript(
                lesson_id=lesson_id,
                lesson_title=lesson.title,
                module_id=lesson.module_id,
                module_name=module.name,
                course_id=module.course_id,
                course_name=course.name,
                transcript_text=transcript_text,
                transcript_vector=transcript_vector,
                searchable_keywords=searchable_keywords
            )
            
            db.session.add(new_transcript)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Transcrição criada com sucesso',
                'id': new_transcript.id
            })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar transcrição: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao salvar transcrição: {str(e)}'
        }), 500

# Delete transcript
@transcript.route('/api/transcript/<int:transcript_id>', methods=['DELETE'])
@admin_required
def delete_transcript(transcript_id):
    transcript = LessonTranscript.query.get(transcript_id)
    
    if not transcript:
        return jsonify({
            'success': False,
            'message': 'Transcrição não encontrada'
        }), 404
    
    try:
        db.session.delete(transcript)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Transcrição excluída com sucesso'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao excluir transcrição: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao excluir transcrição: {str(e)}'
        }), 500

# Get lesson information
@transcript.route('/api/transcript/lesson-info/<int:lesson_id>', methods=['GET'])
@admin_required
def get_lesson_info(lesson_id):
    lesson = Lesson.query.get(lesson_id)
    
    if not lesson:
        return jsonify({
            'success': False,
            'message': 'Aula não encontrada'
        }), 404
    
    module = Module.query.get(lesson.module_id)
    if not module:
        return jsonify({
            'success': False,
            'message': 'Módulo não encontrado'
        }), 404
    
    course = Course.query.get(module.course_id)
    if not course:
        return jsonify({
            'success': False,
            'message': 'Curso não encontrado'
        }), 404
    
    return jsonify({
        'success': True,
        'lesson': {
            'id': lesson.id,
            'title': lesson.title,
            'video_url': lesson.video_url,
            'video_type': lesson.video_type
        },
        'module': {
            'id': module.id,
            'name': module.name
        },
        'course': {
            'id': course.id,
            'name': course.name
        }
    })

# Get total counts for statistics
@transcript.route('/api/transcript/stats', methods=['GET'])
@admin_required
def get_transcript_stats():
    total_transcripts = LessonTranscript.query.count()
    
    courses_with_transcripts = db.session.query(func.count(func.distinct(LessonTranscript.course_id))).scalar()
    
    # Calculate total unique keywords
    all_keywords = db.session.query(LessonTranscript.searchable_keywords).all()
    unique_keywords = set()
    
    for keywords in all_keywords:
        if keywords[0]:
            keyword_list = [k.strip() for k in keywords[0].split(',')]
            unique_keywords.update(keyword_list)
    
    # Remove empty strings
    unique_keywords = {k for k in unique_keywords if k}
    
    return jsonify({
        'total_transcripts': total_transcripts,
        'courses_with_transcripts': courses_with_transcripts,
        'unique_keywords_count': len(unique_keywords)
    })

# Generate transcript metadata (vector and keywords) using AI
@transcript.route('/api/transcript/generate-metadata', methods=['POST'])
@admin_required
def generate_metadata():
    data = request.json
    
    if not data:
        return jsonify({
            'success': False,
            'message': 'Dados não fornecidos'
        }), 400
    
    transcript_text = data.get('transcript_text', '')
    lesson_title = data.get('lesson_title', '')
    module_name = data.get('module_name', '')
    course_name = data.get('course_name', '')
    provider = data.get('provider', 'groq')  # Default to groq
    
    if not transcript_text:
        return jsonify({
            'success': False,
            'message': 'Texto da transcrição não fornecido'
        }), 400
    
    try:
        # Call the function from faq_ai.py to generate metadata
        metadata = generate_transcript_metadata(
            transcript_text, 
            lesson_title, 
            module_name, 
            course_name, 
            provider
        )
        
        return jsonify({
            'success': True,
            'transcript_vector': metadata.get('transcript_vector', ''),
            'searchable_keywords': metadata.get('searchable_keywords', '')
        })
    except Exception as e:
        logger.error(f"Erro ao gerar metadados: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao gerar metadados: {str(e)}'
        }), 500

# API endpoint to get video URL from lesson for YouTube transcription
@transcript.route('/api/transcript/get-video-url/<int:lesson_id>', methods=['GET'])
@admin_required
def get_lesson_video_url(lesson_id):
    lesson = Lesson.query.get(lesson_id)
    
    if not lesson:
        return jsonify({
            'success': False,
            'message': 'Aula não encontrada'
        }), 404
    
    if not lesson.video_url or not lesson.video_type == 'youtube':
        return jsonify({
            'success': False,
            'message': 'Esta aula não possui um vídeo do YouTube'
        }), 400
    
    return jsonify({
        'success': True,
        'video_url': lesson.video_url
    })