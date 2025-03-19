from flask import Blueprint, jsonify, request, current_app, abort
from models import db, LessonTranscript, Settings
from functools import wraps
from flask import session
import requests
import json
import openai
import groq
import os
from flask import url_for
from sqlalchemy import text

chatbot = Blueprint('chatbot', __name__)

# Dicionário para armazenar o histórico de conversas por usuário
# Estrutura: {user_id: [{"role": "user", "content": "mensagem"}, {"role": "assistant", "content": "resposta"}, ...]}
conversation_history = {}

# Número máximo de mensagens para manter no histórico por usuário
MAX_HISTORY_MESSAGES = 15

def student_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_type' not in session or session['user_type'] != 'student':
            return jsonify({"error": "Acesso não autorizado."}), 403
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_type' not in session or session['user_type'] != 'admin':
            return jsonify({"error": "Acesso não autorizado."}), 403
        return f(*args, **kwargs)
    return decorated_function

@chatbot.route('/api/chatbot/config', methods=['GET'])
def get_chatbot_config():
    """Retorna a configuração pública do chatbot (sem chaves API)"""
    settings = Settings.query.first()
    
    if not settings or not settings.chatbot_enabled:
        return jsonify({
            "enabled": False
        })
    
    return jsonify({
        "enabled": settings.chatbot_enabled,
        "provider": settings.chatbot_provider,
        "avatar": settings.chatbot_avatar,
        "name": settings.chatbot_name,
        "welcome_message": settings.chatbot_welcome_message or "Olá! Como posso ajudar com seus estudos hoje?"
    })

@chatbot.route('/api/chatbot/settings', methods=['GET'])
@admin_required
def get_chatbot_settings():
    """Retorna todas as configurações do chatbot para o admin"""
    settings = Settings.query.first()
    
    if not settings:
        return jsonify({"error": "Configurações não encontradas"}), 404
    
    return jsonify({
        "enabled": settings.chatbot_enabled,
        "provider": settings.chatbot_provider,
        "model": settings.chatbot_model,
        "name": settings.chatbot_name,
        "avatar": settings.chatbot_avatar,
        "welcome_message": settings.chatbot_welcome_message,
        "use_internal_knowledge": settings.chatbot_use_internal_knowledge
    })

@chatbot.route('/api/chatbot/settings', methods=['POST'])
@admin_required
def update_chatbot_settings():
    """Atualiza as configurações do chatbot"""
    settings = Settings.query.first()
    
    if not settings:
        return jsonify({"error": "Configurações não encontradas"}), 404
    
    data = request.json
    
    settings.chatbot_enabled = data.get('enabled', False)
    settings.chatbot_provider = data.get('provider')
    settings.chatbot_model = data.get('model')
    settings.chatbot_name = data.get('name')
    settings.chatbot_avatar = data.get('avatar')
    settings.chatbot_welcome_message = data.get('welcome_message')
    settings.chatbot_use_internal_knowledge = data.get('use_internal_knowledge', False)
    
    db.session.commit()
    
    return jsonify({"success": True, "message": "Configurações do chatbot atualizadas com sucesso!"})

@chatbot.route('/api/chatbot/avatar', methods=['POST'])
@admin_required
def upload_chatbot_avatar():
    """Upload de avatar para o chatbot"""
    if 'file' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "Nenhum arquivo selecionado"}), 400
    
    if file:
        # Salvar o arquivo
        filename = f"chatbot_avatar_{file.filename}"
        upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
        
        # Criar pasta se não existir
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        # Atualizar a configuração
        settings = Settings.query.first()
        if settings:
            settings.chatbot_avatar = f"/static/uploads/{filename}"
            db.session.commit()
        
        return jsonify({
            "success": True, 
            "filename": filename,
            "url": f"/static/uploads/{filename}"
        })
    
    return jsonify({"error": "Falha ao salvar o arquivo"}), 500

@chatbot.route('/api/chatbot/models', methods=['GET'])
@admin_required
def get_available_models():
    """Retorna os modelos disponíveis para o chatbot"""
    settings = Settings.query.first()
    
    if not settings:
        return jsonify({"error": "Configurações não encontradas"}), 404
    
    models = {
        "openai": [
            {"id": "gpt-4o", "name": "GPT-4O", "description": "Recomendado - Modelo mais avançado do ChatGPT"},
            {"id": "gpt-4o-mini", "name": "GPT-4O Mini", "description": "Versão mais rápida do GPT-4O"},
            {"id": "gpt-o1", "name": "GPT-O1", "description": "Modelo com bom equilíbrio entre velocidade e qualidade"},
            {"id": "gpt-o1-mini", "name": "GPT-O1 Mini", "description": "Modelo compacto e rápido"},
            {"id": "gpt-o3-mini", "name": "GPT-O3 Mini", "description": "Modelo mais leve e rápido"}
        ],
        "groq": [
            {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 com 70b", "description": "Recomendado - Alta capacidade de análise e síntese"},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 com 70b", "description": "Recomendado - Modelo versátil com forte raciocínio"},
            {"id": "llama-3.2-90b-vision-preview", "name": "Llama 3.2 com 90b", "description": "Modelo de grande capacidade com suporte a visão"},
            {"id": "deepseek-r1-distill-qwen-32b", "name": "DeepSeek R1 com 32b", "description": "Modelo compacto com bom equilíbrio de velocidade e qualidade"},
            {"id": "llama-3.2-11b-vision-preview", "name": "Llama 3.2 com 11b", "description": "Modelo rápido com suporte a visão"},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 com 8b", "description": "Modelo mais leve e rápido para respostas imediatas"}
        ]
    }
    
    return jsonify(models)

@chatbot.route('/api/chatbot/chat', methods=['POST'])
@student_required
def chat_with_bot():
    """Endpoint principal para interação com o chatbot"""
    data = request.json
    query = data.get('message')
    student_id = session.get('user_id')
    
    if not query:
        return jsonify({"error": "Mensagem não fornecida"}), 400
    
    settings = Settings.query.first()
    
    if not settings or not settings.chatbot_enabled:
        return jsonify({"error": "Chatbot não está configurado ou ativado"}), 400
    
    # Verificar se o provider está disponível
    provider = settings.chatbot_provider
    if provider == 'openai' and not settings.openai_api_enabled:
        return jsonify({"error": "OpenAI não está configurada"}), 400
    elif provider == 'groq' and not settings.groq_api_enabled:
        return jsonify({"error": "GROQ não está configurada"}), 400

    # Inicializar o histórico da conversa para este usuário se não existir
    if student_id not in conversation_history:
        conversation_history[student_id] = []
    
    # Determinar se a pergunta parece ser uma conversa casual ou uma dúvida acadêmica
    is_academic_question = is_academic_related(query)
    
    # Se não for uma pergunta acadêmica e o conhecimento interno estiver habilitado
    if not is_academic_question and settings.chatbot_use_internal_knowledge:
        # Adicionar mensagem do usuário ao histórico
        conversation_history[student_id].append({"role": "user", "content": query})
        
        # Chamar a IA com o conhecimento interno
        if provider == 'openai':
            response = call_openai_with_internal_knowledge(query, settings, conversation_history[student_id])
        else:  # groq
            response = call_groq_with_internal_knowledge(query, settings, conversation_history[student_id])
        
        # Adicionar resposta ao histórico
        conversation_history[student_id].append({"role": "assistant", "content": response})
        
        # Limitar o histórico ao número máximo de mensagens
        if len(conversation_history[student_id]) > MAX_HISTORY_MESSAGES:
            conversation_history[student_id] = conversation_history[student_id][-MAX_HISTORY_MESSAGES:]
        
        return jsonify({"response": response})
    
    # Se for uma pergunta acadêmica ou o conhecimento interno estiver desabilitado
    # Buscar as transcrições mais relevantes
    relevant_lessons = search_relevant_lessons(query)
    
    if not relevant_lessons:
        # Se não encontrou aulas relevantes mas o conhecimento interno está ativado
        if settings.chatbot_use_internal_knowledge:
            # Adicionar mensagem do usuário ao histórico
            conversation_history[student_id].append({"role": "user", "content": query})
            
            # Chamar a IA com o conhecimento interno
            if provider == 'openai':
                response = call_openai_with_internal_knowledge(query, settings, conversation_history[student_id])
            else:  # groq
                response = call_groq_with_internal_knowledge(query, settings, conversation_history[student_id])
            
            # Adicionar resposta ao histórico
            conversation_history[student_id].append({"role": "assistant", "content": response})
            
            # Limitar o histórico
            if len(conversation_history[student_id]) > MAX_HISTORY_MESSAGES:
                conversation_history[student_id] = conversation_history[student_id][-MAX_HISTORY_MESSAGES:]
            
            return jsonify({"response": response})
        else:
            # Se o conhecimento interno está desativado, retorna mensagem padrão
            return jsonify({
                "response": "Desculpe, não encontrei informações sobre isso nas aulas. Tente reformular a pergunta ou entre em contato com o suporte."
            })
    
    # Adicionar a mensagem do usuário ao histórico
    conversation_history[student_id].append({"role": "user", "content": query})
    
    # Gerar o prompt para o assistente com as transcrições encontradas
    prompt = generate_assistant_prompt(query, relevant_lessons)
    
    # Chamar a API adequada
    if provider == 'openai':
        # Usa o histórico de conversa se o conhecimento interno estiver habilitado
        if settings.chatbot_use_internal_knowledge:
            response = call_openai_with_transcripts(prompt, settings, conversation_history[student_id])
        else:
            response = call_openai(prompt, settings)
    else:  # groq
        if settings.chatbot_use_internal_knowledge:
            response = call_groq_with_transcripts(prompt, settings, conversation_history[student_id])
        else:
            response = call_groq(prompt, settings)
    
    # Adicionar a resposta do assistente ao histórico
    conversation_history[student_id].append({"role": "assistant", "content": response})
    
    # Limitar o histórico ao número máximo de mensagens
    if len(conversation_history[student_id]) > MAX_HISTORY_MESSAGES:
        conversation_history[student_id] = conversation_history[student_id][-MAX_HISTORY_MESSAGES:]
    
    return jsonify({"response": response})

def is_academic_related(query):
    """
    Verifica se a pergunta parece ser relacionada a conteúdo acadêmico ou apenas conversa casual
    Retorna True se for uma pergunta acadêmica, False se for conversa casual
    """
    # Lista de frases de saudação e conversas casuais comuns
    casual_phrases = [
        "bom dia", "boa tarde", "boa noite", "olá", "oi", "tudo bem", "como vai", 
        "como está", "obrigado", "obrigada", "valeu", "tchau", "até logo", "quem é você",
        "qual seu nome", "como funciona", "o que você faz", "como te chamo"
    ]
    
    query_lower = query.lower()
    
    # Verifica se a pergunta é muito curta (provavelmente uma saudação)
    if len(query_lower.split()) < 3:
        return False
    
    # Verifica se começa com uma saudação comum
    for phrase in casual_phrases:
        if query_lower.startswith(phrase) or query_lower == phrase:
            return False
    
    # Por padrão, considerar como pergunta acadêmica
    return True

def call_openai_with_internal_knowledge(prompt, settings, history):
    """Chama a API da OpenAI permitindo que ela use seu conhecimento interno"""
    try:
        openai.api_key = settings.openai_api
        
        model = settings.chatbot_model or "gpt-3.5-turbo"
        
        # Construir mensagens incluindo o histórico
        messages = [
            {"role": "system", "content": "Você é um assistente educacional útil e amigável. Fale DIRETAMENTE com o aluno, sem mostrar seu raciocínio interno. Use formatação Markdown em suas respostas: **negrito** para ênfase, *itálico* para termos importantes, `código` para termos técnicos. Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href=\"URL\">texto do link</a>."}
        ]
        
        # Adicionar histórico de conversa
        messages.extend(history)
        
        response = openai.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar OpenAI: {str(e)}")
        return "Desculpe, estou enfrentando problemas para responder. Por favor, tente novamente mais tarde."

def call_groq_with_internal_knowledge(prompt, settings, history):
    """Chama a API da GROQ permitindo que ela use seu conhecimento interno"""
    try:
        groq_client = groq.Client(api_key=settings.groq_api)
        
        model = settings.chatbot_model or "deepseek-r1-distill-llama-70b"
        
        # Construir mensagens incluindo o histórico
        messages = [
            {"role": "system", "content": "Você é um assistente educacional útil e amigável. Fale DIRETAMENTE com o aluno, sem mostrar seu raciocínio interno. Use formatação Markdown em suas respostas: **negrito** para ênfase, *itálico* para termos importantes, `código` para termos técnicos. Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href=\"URL\">texto do link</a>."}
        ]
        
        # Adicionar histórico de conversa
        messages.extend(history)
        
        response = groq_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar GROQ: {str(e)}")
        return "Desculpe, estou enfrentando problemas para responder. Por favor, tente novamente mais tarde."

def call_openai_with_transcripts(prompt, settings, history):
    """Chama a API da OpenAI com transcrições e histórico de conversa"""
    try:
        openai.api_key = settings.openai_api
        
        model = settings.chatbot_model or "gpt-3.5-turbo"
        
        # Usamos apenas as últimas X mensagens do histórico para contexto
        recent_history = history[-MAX_HISTORY_MESSAGES:]
        
        # Extrair apenas o conteúdo de user/assistant do histórico para análise
        conversation_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_history])
        
        # Modificar o prompt para incluir o contexto da conversa
        enhanced_prompt = f"""Contexto da conversa anterior:
{conversation_context}

{prompt}

LEMBRE-SE: 
- Fale DIRETAMENTE com o aluno. Não mostre seus pensamentos ou raciocínio interno. 
- Use formatação Markdown para melhorar a legibilidade.
- Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href="URL">texto do link</a>."""
        
        response = openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente educacional útil e amigável. Responda DIRETAMENTE ao aluno sem expor seu raciocínio interno. Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href=\"URL\">texto do link</a>."},
                {"role": "user", "content": enhanced_prompt}
            ],
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar OpenAI: {str(e)}")
        return "Desculpe, estou enfrentando problemas para responder. Por favor, tente novamente mais tarde."

def call_groq_with_transcripts(prompt, settings, history):
    """Chama a API da GROQ com transcrições e histórico de conversa"""
    try:
        groq_client = groq.Client(api_key=settings.groq_api)
        
        model = settings.chatbot_model or "deepseek-r1-distill-llama-70b"
        
        # Usamos apenas as últimas X mensagens do histórico para contexto
        recent_history = history[-MAX_HISTORY_MESSAGES:]
        
        # Extrair apenas o conteúdo de user/assistant do histórico para análise
        conversation_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_history])
        
        # Modificar o prompt para incluir o contexto da conversa
        enhanced_prompt = f"""Contexto da conversa anterior:
{conversation_context}

{prompt}

LEMBRE-SE: 
- Fale DIRETAMENTE com o aluno. Não mostre seus pensamentos ou raciocínio interno. 
- Use formatação Markdown para melhorar a legibilidade.
- Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href="URL">texto do link</a>."""
        
        response = groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente educacional útil e amigável. Responda DIRETAMENTE ao aluno sem expor seu raciocínio interno. Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href=\"URL\">texto do link</a>."},
                {"role": "user", "content": enhanced_prompt}
            ],
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar GROQ: {str(e)}")
        return "Desculpe, estou enfrentando problemas para responder. Por favor, tente novamente mais tarde."

def search_relevant_lessons(query, limit=3):
    """
    Busca as lições mais relevantes para a consulta do usuário.
    Usa uma combinação de correspondência de título, palavras-chave e vetores de texto
    para encontrar as melhores correspondências.
    """
    # Preparar a consulta para SQL
    like_query = f"%{query}%"
    
    # Dividir a consulta em palavras individuais para busca parcial
    query_words = [word.strip() for word in query.lower().split() if len(word.strip()) > 3]
    word_conditions = []
    
    for word in query_words:
        word_conditions.append(f"searchable_keywords ILIKE '%{word}%'")
        word_conditions.append(f"transcript_vector ILIKE '%{word}%'")
    
    # 1. Buscar correspondências por palavras-chave primeiro (prioridade mais alta)
    # Combina tanto busca exata quanto busca por palavras individuais
    keywords_search_sql = text(f"""
        SELECT lt.*, 
               CASE 
                   WHEN lt.searchable_keywords ILIKE :like_query THEN 4 
                   ELSE 3 
               END AS relevance_score
        FROM lesson_transcript lt
        WHERE lt.searchable_keywords ILIKE :like_query
        OR ({" OR ".join(word_conditions)})
        ORDER BY relevance_score DESC
        LIMIT :limit
    """)
    
    keywords_results = db.session.execute(
        keywords_search_sql,
        {"like_query": like_query, "limit": limit}
    ).fetchall()
    
    # 2. Buscar por correspondências nos vetores de texto (prioridade alta)
    vector_search_sql = text("""
        SELECT lt.*, 2.5 AS relevance_score
        FROM lesson_transcript lt
        WHERE lt.transcript_vector ILIKE :like_query
        ORDER BY relevance_score DESC
        LIMIT :limit
    """)
    
    vector_results = db.session.execute(
        vector_search_sql,
        {"like_query": like_query, "limit": limit}
    ).fetchall()
    
    # 3. Buscar por correspondências nos títulos/módulos (prioridade média)
    title_search_sql = text("""
        SELECT 
            lt.*, 
            (
                CASE WHEN lt.lesson_title ILIKE :like_query THEN 2
                     WHEN lt.module_name ILIKE :like_query THEN 1.5
                     WHEN lt.course_name ILIKE :like_query THEN 1
                     ELSE 0
                END
            ) AS relevance_score
        FROM lesson_transcript lt
        WHERE lt.lesson_title ILIKE :like_query
        OR lt.module_name ILIKE :like_query
        OR lt.course_name ILIKE :like_query
        ORDER BY relevance_score DESC
        LIMIT :limit
    """)
    
    title_results = db.session.execute(
        title_search_sql,
        {"like_query": like_query, "limit": limit}
    ).fetchall()
    
    # 4. Finalmente, buscar no texto completo da transcrição (prioridade mais baixa)
    text_search_sql = text("""
        SELECT lt.*, 1 AS relevance_score
        FROM lesson_transcript lt
        WHERE lt.transcript_text ILIKE :like_query
        LIMIT :limit
    """)
    
    text_results = db.session.execute(
        text_search_sql,
        {"like_query": like_query, "limit": limit}
    ).fetchall()
    
    # Combinar todos os resultados e classificar por relevância
    results = []
    result_ids = set()  # Para evitar duplicatas
    
    # Função para adicionar resultados sem duplicatas
    def add_results(results_list):
        for row in results_list:
            if row.id not in result_ids:
                transcript = LessonTranscript.query.get(row.id)
                if transcript:
                    results.append({
                        'transcript': transcript,
                        'score': row.relevance_score
                    })
                    result_ids.add(row.id)
    
    # Adicionar resultados em ordem de prioridade
    add_results(keywords_results)
    add_results(vector_results)
    add_results(title_results)
    add_results(text_results)
    
    # Ordenar por pontuação de relevância
    results.sort(key=lambda x: x['score'], reverse=True)
    
    # Retornar apenas os objetos de transcrição, limitados ao número desejado
    return [item['transcript'] for item in results[:limit]]

def generate_assistant_prompt(query, lessons):
    """Gera o prompt para o assistente com base na consulta e nas lições relevantes"""
    base_url = request.url_root.rstrip('/')
    
    prompt = f"""Você é um assistente educacional amigável para um aluno de cursos online.
IMPORTANTE: Responda DIRETAMENTE ao aluno, sem expor seu raciocínio interno ou pensamentos. Nunca use frases como "o aluno está perguntando" ou "vou estruturar a resposta".

O aluno está perguntando: "{query}"

Com base na transcrição das aulas abaixo, responda à pergunta do aluno de forma clara e concisa.
Caso uma aula mencione tópicos relacionados a desenvolvimento pessoal, superação de vícios, abandono de maus hábitos, 
ou qualquer conteúdo similar ao que o aluno está perguntando, mesmo que não seja uma correspondência exata, 
você deve extrair e aplicar esse conhecimento para responder.

Se você não encontrar a resposta nas transcrições fornecidas, indique isso educadamente.
Se a resposta estiver nas transcrições, inclua ao final da resposta qual aula contém essa informação.

Informações das aulas relevantes:
"""
    
    for lesson in lessons:
        course_id = lesson.course_id
        module_id = lesson.module_id
        lesson_id = lesson.lesson_id
        lesson_url = f"{base_url}/course/{course_id}/module/{module_id}/lesson/{lesson_id}"
        
        prompt += f"""
AULA: {lesson.lesson_title}
MÓDULO: {lesson.module_name}
CURSO: {lesson.course_name}
URL: {lesson_url}

TRANSCRIÇÃO:
{lesson.transcript_text[:1000]}...

"""
    
    prompt += """
INSTRUÇÕES IMPORTANTES:
1. Responda DIRETAMENTE como se estivesse falando com o aluno, sem metadiscurso.
2. Para perguntas simples ou saudações como "olá", "bom dia", responda brevemente e naturalmente.
3. Nunca exponha seu raciocínio interno ou processo de pensamento na resposta.
4. Use formatação Markdown para tornar suas respostas mais claras e organizadas:
   - Use **texto** para negrito (enfatizar pontos importantes)
   - Use *texto* para itálico
   - Use `código` para termos técnicos ou comandos
   - Use listas com "- item" para enumerar pontos
   - Use # e ## para títulos e subtítulos quando apropriado
5. Se a informação estiver disponível em uma das aulas, termine sua resposta com esta mensagem exata (substituindo apenas os dados entre colchetes):
   "Você pode encontrar mais detalhes sobre isso na aula '[NOME DA AULA]' do módulo '[NOME DO MÓDULO]'."
6. Depois da mensagem acima, inclua o link da aula usando o formato HTML: <a href="URL">Link para a aula</a>
"""
    
    return prompt

def call_openai(prompt, settings):
    """Chama a API da OpenAI para gerar resposta com base no prompt"""
    try:
        openai.api_key = settings.openai_api
        
        model = settings.chatbot_model or "gpt-3.5-turbo"
        
        response = openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente educacional útil e amigável. Responda DIRETAMENTE ao aluno sem expor seu raciocínio interno."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar OpenAI: {str(e)}")
        return "Desculpe, estou enfrentando problemas para responder. Por favor, tente novamente mais tarde."

def call_groq(prompt, settings):
    """Chama a API da GROQ para gerar resposta com base no prompt"""
    try:
        groq_client = groq.Client(api_key=settings.groq_api)
        
        model = settings.chatbot_model or "deepseek-r1-distill-llama-70b"
        
        response = groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Você é um assistente educacional útil e amigável. Responda DIRETAMENTE ao aluno sem expor seu raciocínio interno. Para links, você pode usar tanto o formato Markdown [texto do link](URL) quanto o formato HTML <a href=\"URL\">texto do link</a>."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        current_app.logger.error(f"Erro ao chamar GROQ: {str(e)}")
        return "Desculpe, estou enfrentando problemas para responder. Por favor, tente novamente mais tarde."
