from flask import Blueprint, request, jsonify, session, current_app, render_template
from werkzeug.utils import secure_filename
from models import db, Showcase, Admin, Course, ShowcaseAnalytics  # Modified: Added ShowcaseAnalytics
from functools import wraps
from datetime import datetime
import os
from pytz import timezone  # Modified import

showcase = Blueprint('showcase', __name__)

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('user_type') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@showcase.route('/admin/showcase')
@admin_required
def admin_showcase():
    return render_template('showcase.html')

@showcase.route('/admin/api/showcase', methods=['GET'])
@admin_required
def get_showcase_items():
    try:
        items = Showcase.query.all()
        return jsonify([{
            'id': item.id,
            'name': item.name,
            'description': item.description,
            'image': item.image,
            'button_text': item.button_text,
            'button_link': item.button_link,
            'price': item.price,
            'has_video': item.has_video,
            'video_url': item.video_url,
            'status': item.status,
            'priority': item.priority,
            'button_delay': item.button_delay,
            'course_id': item.course_id,
            'created_at': item.created_at.isoformat() if item.created_at else None
        } for item in items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@showcase.route('/admin/api/showcase', methods=['POST'])
@admin_required
def create_showcase_item():
    try:
        # Extract data from form
        name = request.form['name']
        description = request.form['description']
        course_id = request.form.get('course_id')  # Get course_id from form
        
        if not course_id:
            return jsonify({'success': False, 'message': 'Course ID is required'}), 400
            
        # Check if course exists
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'success': False, 'message': 'Invalid course ID'}), 404

        # Process image if provided
        image = request.files.get('image')
        if image:
            filename = f"showcase_{datetime.now().strftime('%Y%m%d%H%M%S')}.{image.filename.split('.')[-1]}"
            image.save(os.path.join('static/uploads', filename))
        else:
            filename = None

        # Create new showcase item
        new_item = Showcase(
            name=name,
            description=description,
            image=filename,
            button_text=request.form.get('button_text'),
            button_link=request.form.get('button_link'),
            price=request.form.get('price'),
            has_video=request.form.get('has_video', '').lower() == 'true',
            video_url=request.form.get('video_url'),
            status='inactive',  # Default to inactive
            priority=int(request.form.get('priority', 5)),
            button_delay=int(request.form.get('button_delay', 0)),
            course_id=course_id  # Set the course_id
        )

        db.session.add(new_item)
        db.session.commit()

        return jsonify({
            'success': True,
            'item': {
                'id': new_item.id,
                'name': new_item.name,
                'description': new_item.description,
                'image': new_item.image,
                'button_text': new_item.button_text,
                'button_link': new_item.button_link,
                'price': new_item.price,
                'has_video': new_item.has_video,
                'video_url': new_item.video_url,
                'status': new_item.status,
                'priority': new_item.priority,
                'button_delay': new_item.button_delay,
                'course_id': new_item.course_id
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@showcase.route('/admin/api/showcase/<int:item_id>', methods=['PUT'])
@admin_required
def update_showcase_item(item_id):
    try:
        item = Showcase.query.get_or_404(item_id)
        
        # Update course_id if provided
        course_id = request.form.get('course_id')
        if course_id:
            course = Course.query.get(course_id)
            if not course:
                return jsonify({'success': False, 'message': 'Invalid course ID'}), 404
            item.course_id = course_id

        # Update other fields
        if 'name' in request.form:
            item.name = request.form['name']
        if 'description' in request.form:
            item.description = request.form['description']
        if 'button_text' in request.form:
            item.button_text = request.form['button_text']
        if 'button_link' in request.form:
            item.button_link = request.form['button_link']
        if 'price' in request.form:
            item.price = request.form['price']
        if 'has_video' in request.form:
            item.has_video = request.form['has_video'].lower() == 'true'
        if 'video_url' in request.form:
            item.video_url = request.form['video_url']
        if 'priority' in request.form:
            item.priority = int(request.form['priority'])
        if 'button_delay' in request.form:
            item.button_delay = int(request.form['button_delay'])

        # Handle image update if provided
        image = request.files.get('image')
        if image:
            if item.image:  # Delete old image if exists
                try:
                    os.remove(os.path.join('static/uploads', item.image))
                except:
                    pass  # Ignore if file doesn't exist
            
            filename = f"showcase_{datetime.now().strftime('%Y%m%d%H%M%S')}.{image.filename.split('.')[-1]}"
            image.save(os.path.join('static/uploads', filename))
            item.image = filename

        db.session.commit()

        return jsonify({
            'success': True,
            'item': {
                'id': item.id,
                'name': item.name,
                'description': item.description,
                'image': item.image,
                'button_text': item.button_text,
                'button_link': item.button_link,
                'price': item.price,
                'has_video': item.has_video,
                'video_url': item.video_url,
                'status': item.status,
                'priority': item.priority,
                'button_delay': item.button_delay,
                'course_id': item.course_id
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# New endpoint for status toggle update
@showcase.route('/admin/api/showcase/<int:item_id>/status', methods=['PATCH'])
@admin_required
def update_showcase_status(item_id):
    try:
        item = Showcase.query.get_or_404(item_id)
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status not in ['active', 'inactive']:
            return jsonify({'success': False, 'message': 'Status inválido'}), 400
            
        # Se estiver tentando ativar, verificar se já existe outro item ativo para o mesmo curso
        if new_status == 'active':
            existing_active = Showcase.query.filter(
                Showcase.course_id == item.course_id,
                Showcase.status == 'active',
                Showcase.id != item_id
            ).first()
            
            if existing_active:
                return jsonify({
                    'success': False, 
                    'message': 'Já existe uma vitrine ativa para este curso. Por favor, desative-a primeiro.',
                    'conflicting_item': {
                        'id': existing_active.id,
                        'name': existing_active.name
                    }
                }), 409

        item.status = new_status
        db.session.commit()
        return jsonify({'success': True, 'message': 'Status atualizado', 'status': item.status})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@showcase.route('/admin/api/showcase/<int:item_id>', methods=['DELETE'])
@admin_required
def delete_showcase_item(item_id):
    item = Showcase.query.get_or_404(item_id)
    
    if item.image:
        try:
            os.remove(os.path.join('static/uploads', item.image))
        except:
            pass
    
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({'success': True})

@showcase.route('/api/showcase/<int:showcase_id>/analytics/view', methods=['POST'])
def update_showcase_view(showcase_id):
    # Atualiza as views para o showcase_id de hoje
    try:
        tz = timezone('America/Sao_Paulo')  # Use timezone directly
        today = datetime.now(tz).date()
        record = ShowcaseAnalytics.query.filter_by(showcase_id=showcase_id, date=today).first()
        if record:
            record.views += 1
        else:
            record = ShowcaseAnalytics(showcase_id=showcase_id, date=today, views=1, conversions=0)
            db.session.add(record)
        db.session.commit()
        return jsonify({'success': True, 'views': record.views})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@showcase.route('/api/showcase/<int:showcase_id>/analytics/checkout', methods=['POST'])
def update_showcase_conversion(showcase_id):
    # Atualiza as conversions para o showcase_id de hoje
    try:
        tz = timezone('America/Sao_Paulo')  # Use timezone directly
        today = datetime.now(tz).date()
        record = ShowcaseAnalytics.query.filter_by(showcase_id=showcase_id, date=today).first()
        if record:
            record.conversions += 1
        else:
            record = ShowcaseAnalytics(showcase_id=showcase_id, date=today, views=0, conversions=1)
            db.session.add(record)
        db.session.commit()
        return jsonify({'success': True, 'conversions': record.conversions})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
