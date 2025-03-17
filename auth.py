from flask import session, redirect, url_for, flash
from functools import wraps
from database import Admin, Student

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or 'user_type' not in session or session['user_type'] != 'admin':
            flash('Você precisa estar logado como administrador para acessar esta página.', 'error')
            return redirect(url_for('login'))
        admin = Admin.query.get(session['user_id'])
        if not admin:
            flash('Acesso não autorizado.', 'error')
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

def login_user(user, user_type):
    session['user_id'] = user.id
    session['user_type'] = user_type

def logout_user():
    session.clear()

def get_current_user():
    if 'user_id' in session:
        if session['user_type'] == 'admin':
            return Admin.query.get(session['user_id'])
        elif session['user_type'] == 'student':
            return Student.query.get(session['user_id'])
    return None