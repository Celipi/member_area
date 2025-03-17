from flask import Blueprint, jsonify, request
from datetime import datetime
import os
from models import db, Promotion
from werkzeug.utils import secure_filename
from functools import wraps
from flask import session

promote = Blueprint('promote', __name__)

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or 'user_type' not in session or session['user_type'] != 'admin':
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Endpoint para obter promoções ativas para estudantes (modificado para retornar todas)
@promote.route('/api/active-promotions', methods=['GET'])
def get_active_promotions():
    now = datetime.utcnow()
    
    # Encontrar todas as promoções ativas e válidas (dentro do período)
    promotions = Promotion.query.filter(
        Promotion.is_active == True,
        Promotion.start_date <= now,
        Promotion.end_date >= now
    ).all()
    
    if not promotions:
        return jsonify({'success': False, 'message': 'No active promotions'})
    
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
        } for promo in promotions]
    })

# Manter o endpoint antigo por compatibilidade
@promote.route('/api/active-promotion', methods=['GET'])
def get_active_promotion():
    now = datetime.utcnow()
    
    # Encontrar a primeira promoção ativa e válida
    promotion = Promotion.query.filter(
        Promotion.is_active == True,
        Promotion.start_date <= now,
        Promotion.end_date >= now
    ).first()
    
    if not promotion:
        return jsonify({'success': False, 'message': 'No active promotions'})
    
    return jsonify({
        'success': True,
        'promotion': {
            'id': promotion.id,
            'title': promotion.title,
            'description': promotion.description,
            'media_type': promotion.media_type,
            'media_url': promotion.media_url,
            'has_cta': promotion.has_cta,
            'cta_text': promotion.cta_text,
            'cta_url': promotion.cta_url,
            'button_delay': promotion.button_delay,
            'hide_video_controls': promotion.hide_video_controls
        }
    })

@promote.route('/api/promotions', methods=['GET'])
@admin_required
def get_promotions():
    page = request.args.get('page', 1, type=int)
    per_page = 10
    search = request.args.get('search', '')
    status_filter = request.args.get('status', '')

    query = Promotion.query

    if search:
        query = query.filter(Promotion.title.ilike(f'%{search}%'))
    
    if status_filter:
        now = datetime.utcnow()
        if status_filter == 'active':
            query = query.filter(
                Promotion.is_active == True,
                Promotion.start_date <= now,
                Promotion.end_date >= now
            )
        elif status_filter == 'inactive':
            query = query.filter(Promotion.is_active == False)
        elif status_filter == 'upcoming':
            query = query.filter(
                Promotion.is_active == True,
                Promotion.start_date > now
            )
        elif status_filter == 'expired':
            query = query.filter(
                Promotion.is_active == True,
                Promotion.end_date < now
            )

    promotions = query.order_by(Promotion.created_at.desc()).paginate(page=page, per_page=per_page)

    return jsonify({
        'promotions': [{
            'id': p.id,
            'title': p.title,
            'description': p.description,
            'media_type': p.media_type,
            'media_url': p.media_url,
            'start_date': p.start_date.strftime('%Y-%m-%d'),
            'end_date': p.end_date.strftime('%Y-%m-%d'),
            'button_delay': p.button_delay,
            'has_cta': p.has_cta,
            'cta_text': p.cta_text,
            'cta_url': p.cta_url,
            'is_active': p.is_active,
            'status': get_promotion_status(p),
            'hide_video_controls': p.hide_video_controls
        } for p in promotions.items],
        'total_pages': promotions.pages,
        'current_page': page,
        'total': promotions.total,
        'active': Promotion.query.filter(
            Promotion.is_active == True,
            Promotion.start_date <= datetime.utcnow(),
            Promotion.end_date >= datetime.utcnow()
        ).count()
    })

def get_promotion_status(promotion):
    now = datetime.utcnow()
    if not promotion.is_active:
        return 'inactive'
    elif promotion.start_date > now:
        return 'upcoming'
    elif promotion.end_date < now:
        return 'expired'
    else:
        return 'active'

@promote.route('/api/promotions', methods=['POST'])
@admin_required
def create_promotion():
    try:
        data = request.form.to_dict()
        
        # Check if this is an update (promotion_id exists)
        promotion_id = data.get('promotion_id')
        if promotion_id:
            # This is an update, redirect to update method
            return update_promotion(int(promotion_id))
        
        # Ensure media_type is present
        if 'mediaType' in data:
            media_type = data['mediaType']
        else:
            # Default to image if not specified
            media_type = 'image'
        
        # Handle media upload based on type
        if media_type == 'image':
            if 'media_file' not in request.files:
                return jsonify({'success': False, 'error': 'No media file provided'}), 400
            
            file = request.files['media_file']
            if file.filename == '':
                return jsonify({'success': False, 'error': 'No file selected'}), 400
            
            # Create uploads directory if it doesn't exist
            uploads_dir = os.path.join('static', 'uploads')
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir)
            
            # Save the file with a secure name
            filename = f'promotion_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}_{secure_filename(file.filename)}'
            file_path = os.path.join(uploads_dir, filename)
            file.save(file_path)
            media_url = filename
        elif media_type == 'video':
            # For video, use the provided URL
            if 'media_url' not in data or not data['media_url'].strip():
                return jsonify({'success': False, 'error': 'Video URL is required'}), 400
            media_url = data['media_url']
        else:
            return jsonify({'success': False, 'error': 'Invalid media type'}), 400

        # Process boolean fields
        has_cta = data.get('has_cta', 'false').lower() in ['true', 'on', '1', 'yes']
        hide_video_controls = data.get('hide_video_controls', 'true').lower() in ['true', 'on', '1', 'yes']
        
        # Process button_delay - Garantir que é 0 para imagens
        if media_type == 'image':
            button_delay = 0
        else:
            # Process button_delay normalmente para vídeos
            button_delay = 0
            if 'button_delay' in data and data['button_delay']:
                try:
                    button_delay = int(data['button_delay'])
                except ValueError:
                    button_delay = 0

        # For new promotions, always set is_active to False
        is_active = False

        # Create new promotion
        new_promotion = Promotion(
            title=data['title'],
            description=data['description'],
            media_type=media_type,
            media_url=media_url,
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d'),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d'),
            button_delay=button_delay,
            has_cta=has_cta,
            cta_text=data.get('cta_text', '') if has_cta else None,
            cta_url=data.get('cta_url', '') if has_cta else None,
            is_active=is_active,  # Always False for new promotions
            created_at=datetime.utcnow(),
            hide_video_controls=hide_video_controls
        )

        db.session.add(new_promotion)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Promoção criada com sucesso',
            'promotion': {
                'id': new_promotion.id,
                'title': new_promotion.title,
                'status': get_promotion_status(new_promotion)
            }
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error creating promotion: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@promote.route('/api/promotions/<int:id>', methods=['GET'])
@admin_required
def get_promotion(id):
    promotion = Promotion.query.get_or_404(id)
    return jsonify({
        'id': promotion.id,
        'title': promotion.title,
        'description': promotion.description,
        'media_type': promotion.media_type,
        'media_url': promotion.media_url,
        'start_date': promotion.start_date.strftime('%Y-%m-%d'),
        'end_date': promotion.end_date.strftime('%Y-%m-%d'),
        'button_delay': promotion.button_delay,
        'has_cta': promotion.has_cta,
        'cta_text': promotion.cta_text,
        'cta_url': promotion.cta_url,
        'is_active': promotion.is_active,
        'status': get_promotion_status(promotion),
        'hide_video_controls': promotion.hide_video_controls
    })

@promote.route('/api/promotions/<int:id>', methods=['PUT'])
@admin_required
def update_promotion(id):
    promotion = Promotion.query.get_or_404(id)
    
    try:
        data = request.form.to_dict()
        
        # Handle media type
        media_type = data.get('mediaType', data.get('media_type', promotion.media_type))

        # Handle media update based on type
        if media_type == 'image':
            if 'media_file' in request.files and request.files['media_file'].filename:
                file = request.files['media_file']
                # Delete old image if exists
                if promotion.media_type == 'image' and promotion.media_url:
                    old_file = os.path.join('static', 'uploads', promotion.media_url)
                    if os.path.exists(old_file):
                        try:
                            os.remove(old_file)
                        except Exception as e:
                            print(f"Failed to delete old image: {str(e)}")
                
                # Save new image
                uploads_dir = os.path.join('static', 'uploads')
                if not os.path.exists(uploads_dir):
                    os.makedirs(uploads_dir)
                    
                filename = f'promotion_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}_{secure_filename(file.filename)}'
                file_path = os.path.join(uploads_dir, filename)
                file.save(file_path)
                promotion.media_url = filename
                promotion.media_type = 'image'
        elif media_type == 'video':
            if 'media_url' in data and data['media_url'].strip():
                promotion.media_url = data['media_url']
                promotion.media_type = 'video'

        # Process boolean fields
        has_cta = data.get('has_cta', 'false').lower() in ['true', 'on', '1', 'yes']
        hide_video_controls = data.get('hide_video_controls', 'true').lower() in ['true', 'on', '1', 'yes']
        
        # Process button_delay - Garantir que é 0 para imagens
        if media_type == 'image':
            button_delay = 0
        else:
            # Process button_delay normalmente para vídeos
            button_delay = 0
            if 'button_delay' in data and data['button_delay']:
                try:
                    button_delay = int(data['button_delay'])
                except ValueError:
                    button_delay = 0
        
        # Keep the existing active status
        is_active = promotion.is_active

        # Update fields
        promotion.title = data['title']
        promotion.description = data['description']
        promotion.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
        promotion.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
        promotion.button_delay = button_delay
        promotion.has_cta = has_cta
        promotion.cta_text = data.get('cta_text', '') if has_cta else None
        promotion.cta_url = data.get('cta_url', '') if has_cta else None
        promotion.is_active = is_active  # Maintain the existing active status
        promotion.hide_video_controls = hide_video_controls

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Promoção atualizada com sucesso',
            'promotion': {
                'id': promotion.id,
                'title': promotion.title,
                'status': get_promotion_status(promotion)
            }
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error updating promotion: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@promote.route('/api/promotions/<int:id>', methods=['DELETE'])
@admin_required
def delete_promotion(id):
    promotion = Promotion.query.get_or_404(id)

    try:
        # Delete associated image if exists
        if promotion.media_type == 'image':
            file_path = os.path.join('static', 'uploads', promotion.media_url)
            if os.path.exists(file_path):
                os.remove(file_path)

        db.session.delete(promotion)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Promoção excluída com sucesso'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@promote.route('/api/promotions/<int:id>/toggle', methods=['POST'])
@admin_required
def toggle_promotion(id):
    promotion = Promotion.query.get_or_404(id)
    promotion.is_active = not promotion.is_active
    
    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Promoção {"ativada" if promotion.is_active else "desativada"} com sucesso',
            'is_active': promotion.is_active
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500