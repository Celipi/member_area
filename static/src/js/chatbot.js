/**
 * MembriumWL - Chatbot de Suporte
 * Script para adicionar um chatbot de suporte às páginas do aluno
 */

class MembriumChatbot {
    constructor() {
        this.initialized = false;
        this.config = null;
        this.container = null;
        this.chatButton = null;
        this.chatWindow = null;
        this.messages = [];
        this.isOpen = false;
        this.isLoading = false;
        
        // Inicializar
        this.init();
    }
    
    async init() {
        // Verificar se o chatbot está habilitado
        try {
            const response = await fetch('/api/chatbot/config');
            this.config = await response.json();
            
            if (!this.config.enabled) {
                console.log('Chatbot não está ativado.');
                return;
            }
            
            // Adicionar estilos CSS
            this.injectStyles();
            
            // Criar elementos do chatbot
            this.createChatbotElements();
            
            // Adicionar evento de clique no botão do chatbot
            this.chatButton.addEventListener('click', () => this.toggleChat());
            
            // Adicionar evento de envio de mensagem
            const form = this.chatWindow.querySelector('.chat-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
            
            // Adicionar evento de fecha
            const closeButton = this.chatWindow.querySelector('.chat-header-close');
            closeButton.addEventListener('click', () => this.toggleChat());
            
            this.initialized = true;
            
        } catch (error) {
            console.error('Erro ao inicializar chatbot:', error);
        }
    }
    
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .chatbot-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            
            .chat-button {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background-color: #B91C1C;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
            }
            
            .chat-button:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
            }
            
            .chat-button svg {
                width: 30px;
                height: 30px;
                color: white;
            }
            
            .chat-button.has-unread::after {
                content: '';
                position: absolute;
                top: 0;
                right: 0;
                width: 12px;
                height: 12px;
                background-color: #EF4444;
                border-radius: 50%;
                border: 2px solid white;
            }
            
            .chat-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 350px;
                height: 500px;
                background-color: white;
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform-origin: bottom right;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                transform: scale(0);
                opacity: 0;
            }
            
            .chat-window.open {
                transform: scale(1);
                opacity: 1;
            }
            
            .chat-header {
                padding: 16px;
                background-color: #B91C1C;
                color: white;
                display: flex;
                align-items: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .chat-header-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background-color: white;
                margin-right: 12px;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .chat-header-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .chat-header-info {
                flex: 1;
            }
            
            .chat-header-name {
                font-weight: 600;
                font-size: 16px;
            }
            
            .chat-header-status {
                font-size: 12px;
                opacity: 0.8;
            }
            
            .chat-header-close {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            
            .chat-header-close:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }
            
            .chat-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background-color: #F9FAFB;
            }
            
            .chat-message {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 16px;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                position: relative;
                word-wrap: break-word;
            }
            
            .chat-message.user {
                align-self: flex-end;
                background-color: #B91C1C;
                color: white;
                border-bottom-right-radius: 4px;
            }
            
            .chat-message.bot {
                align-self: flex-start;
                background-color: white;
                color: #1F2937;
                border-bottom-left-radius: 4px;
                line-height: 1.5;
            }
            
            .chat-message a {
                color: inherit;
                text-decoration: underline;
                font-weight: 500;
            }
            
            .chat-message.bot a {
                color: #B91C1C;
            }
            
            .chat-message-time {
                font-size: 10px;
                opacity: 0.7;
                margin-top: 4px;
                text-align: right;
            }
            
            .chat-footer {
                padding: 12px 16px;
                border-top: 1px solid #E5E7EB;
                background-color: white;
            }
            
            .chat-form {
                display: flex;
                gap: 8px;
            }
            
            .chat-input {
                flex: 1;
                padding: 10px 16px;
                border-radius: 24px;
                border: 1px solid #D1D5DB;
                outline: none;
                font-size: 14px;
                transition: border-color 0.2s;
            }
            
            .chat-input:focus {
                border-color: #B91C1C;
                box-shadow: 0 0 0 2px rgba(185, 28, 28, 0.2);
            }
            
            .chat-send {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: #B91C1C;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                transition: background-color 0.2s;
            }
            
            .chat-send:hover {
                background-color: #991B1B;
            }
            
            .chat-send svg {
                width: 20px;
                height: 20px;
            }
            
            .typing-indicator {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
                background-color: white;
                border-radius: 16px;
                align-self: flex-start;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                max-width: 80px;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                background-color: #D1D5DB;
                border-radius: 50%;
                animation: typing 1s infinite ease-in-out;
            }
            
            .typing-dot:nth-child(1) {
                animation-delay: 0s;
            }
            
            .typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }
            
            .typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }
            
            /* Estilos para formatação markdown */
            .chat-message.bot code {
                background-color: rgba(0, 0, 0, 0.05);
                padding: 2px 4px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.9em;
            }
            
            .chat-message.bot h3 {
                margin: 10px 0 5px 0;
                font-size: 1.1em;
                font-weight: 600;
            }
            
            .chat-message.bot h4 {
                margin: 8px 0 4px 0;
                font-size: 1em;
                font-weight: 600;
            }
            
            .chat-message.bot ul {
                margin: 8px 0;
                padding-left: 20px;
            }
            
            .chat-message.bot li {
                margin-bottom: 4px;
                list-style-type: disc;
            }
            
            .chat-message.bot strong {
                font-weight: 600;
            }
            
            .chat-message.bot em {
                font-style: italic;
            }
            
            .chat-message.bot a {
                color: #B91C1C;
                text-decoration: underline;
                position: relative;
                white-space: normal;
                word-break: break-word;
            }
            
            .chat-message.bot a:hover {
                text-decoration: none;
                background-color: rgba(185, 28, 28, 0.1);
            }
            
            .chat-message.bot a:after {
                content: '';
                display: inline-block;
                width: 10px;
                height: 10px;
                margin-left: 3px;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23B91C1C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 17l9.2-9.2M17 17V7H7'/%3E%3C/svg%3E");
                background-size: contain;
                background-repeat: no-repeat;
                opacity: 0.7;
            }
            
            @keyframes typing {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-5px);
                }
            }
            
            @media (max-width: 640px) {
                .chat-window {
                    width: calc(100vw - 40px);
                    height: 60vh;
                    bottom: 70px;
                    right: 0;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    createChatbotElements() {
        // Criar container principal
        this.container = document.createElement('div');
        this.container.className = 'chatbot-container';
        document.body.appendChild(this.container);
        
        // Criar botão do chat
        this.chatButton = document.createElement('div');
        this.chatButton.className = 'chat-button';
        this.chatButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
        this.container.appendChild(this.chatButton);
        
        // Criar janela do chat
        this.chatWindow = document.createElement('div');
        this.chatWindow.className = 'chat-window';
        
        // Avatar default ou do config
        const avatarSrc = this.config.avatar ? this.config.avatar : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjkxYzFjIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9Imx1Y2lkZSBsdWNpZGUtbWVzc2FnZS1jaXJjbGUiPjxwYXRoIGQ9Ik0yMSAxMS41YTguMzggOC4zOCAwIDAgMS0uOSAzLjggOC41IDguNSAwIDAgMS03LjYgNC43IDguMzggOC4zOCAwIDAgMS0zLjgtLjlMMyAyMWwxLjktNS43YTguMzggOC4zOCAwIDAgMS0uOS0zLjggOC41IDguNSAwIDAgMSA0LjctNy42IDguMzggOC4zOCAwIDAgMSAzLjgtLjloLjVhOC40OCA4LjQ4IDAgMCAxIDggOHYuNXoiPjwvcGF0aD48L3N2Zz4=';
        
        this.chatWindow.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-avatar">
                    <img src="${avatarSrc}" alt="Avatar">
                </div>
                <div class="chat-header-info">
                    <div class="chat-header-name">${this.config.name || 'Assistente Virtual'}</div>
                    <div class="chat-header-status">Online</div>
                </div>
                <div class="chat-header-close">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
            </div>
            <div class="chat-messages">
                <!-- Mensagens serão adicionadas aqui -->
            </div>
            <div class="chat-footer">
                <form class="chat-form">
                    <input type="text" class="chat-input" placeholder="Digite sua pergunta..." autocomplete="off">
                    <button type="submit" class="chat-send">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </form>
            </div>
        `;
        
        this.container.appendChild(this.chatWindow);
        
        // Adicionar mensagem de boas-vindas
        this.addMessage(this.config.welcome_message || 'Olá! Como posso ajudar com seus estudos hoje?', 'bot');
    }
    
    toggleChat() {
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            this.chatWindow.classList.add('open');
            // Rolar para a última mensagem
            setTimeout(() => {
                const messagesContainer = this.chatWindow.querySelector('.chat-messages');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // Focar no input
                const input = this.chatWindow.querySelector('.chat-input');
                input.focus();
            }, 300);
        } else {
            this.chatWindow.classList.remove('open');
        }
    }
    
    addMessage(text, sender, time = null) {
        const messagesContainer = this.chatWindow.querySelector('.chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender}`;
        
        // Processar links no texto
        const processedText = this.processMessageText(text);
        
        messageElement.innerHTML = `
            ${processedText}
            <div class="chat-message-time">${time || this.getCurrentTime()}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        
        // Rolar para a nova mensagem
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Salvar mensagem no histórico
        this.messages.push({
            text,
            sender,
            time: time || this.getCurrentTime()
        });
    }
    
    // Processar links e formatação básica no texto
    processMessageText(text) {
        // Detectar o padrão exato relatado pelo usuário:
        // "http://127.0.0.1:3000/course/1/module/1/lesson/2" target="_blank" rel="noopener noreferrer">Link para a aula"
        const exactErrorPattern = /"(https?:\/\/[^"]+)"(\s+target="_blank"\s+rel="noopener noreferrer">)([^<"]+)"/g;
        text = text.replace(exactErrorPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$3</a>');
        
        // Detectar e corrigir links mal formatados onde a tag <a> e seus atributos aparecem como texto
        const brokenLinkPattern = /"?(https?:\/\/[^"\s]+)"?\s+target=(?:"_blank"|'_blank'|_blank)\s+rel=(?:"noopener noreferrer"|'noopener noreferrer'|noopener noreferrer)">([^<]+)/g;
        text = text.replace(brokenLinkPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
        
        // Função para escapar caracteres especiais HTML exceto tags <a>
        const escapeHTML = (str) => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
        
        // Extrair e preservar tags <a> antes de escapar HTML
        const preservedLinks = [];
        let textWithPlaceholders = text;
        
        // Regex para encontrar tags <a> completas
        const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
        let match;
        let i = 0;
        
        // Extrair links HTML e substituí-los por placeholders
        while ((match = linkRegex.exec(text)) !== null) {
            const fullLink = match[0]; // Tag <a> completa
            const placeholder = `__LINK_PLACEHOLDER_${i}__`;
            textWithPlaceholders = textWithPlaceholders.replace(fullLink, placeholder);
            preservedLinks.push({
                placeholder: placeholder,
                html: fullLink
            });
            i++;
        }
        
        // Escapar HTML no texto com placeholders (não afetará os placeholders)
        let processedText = escapeHTML(textWithPlaceholders);
        
        // Processar Markdown
        
        // Links no formato [texto](url)
        processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Negrito **texto**
        processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Itálico *texto*
        processedText = processedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Código `texto`
        processedText = processedText.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Listas
        // - Item 1
        // - Item 2
        processedText = processedText.replace(/^- (.+)$/gm, '<li>$1</li>');
        processedText = processedText.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Cabeçalhos
        // # Título
        processedText = processedText.replace(/^# (.+)$/gm, '<h3>$1</h3>');
        processedText = processedText.replace(/^## (.+)$/gm, '<h4>$1</h4>');
        
        // Corrigir links em formato incorreto em que o HTML foi escapado
        processedText = processedText.replace(/(https?:\/\/[^\s&]+)&quot;\s+target=&quot;_blank&quot;\s+rel=&quot;noopener noreferrer&quot;&gt;([^<]+)/g, 
            '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
        
        // Converter URLs em links clicáveis (para URLs que não foram formatadas com Markdown)
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        processedText = processedText.replace(urlRegex, (url) => {
            // Não substituir URLs que já estão dentro de tags de âncora
            if (url.includes('href=')) return url;
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
        // Restaurar as tags <a> originais no lugar dos placeholders
        for (const link of preservedLinks) {
            processedText = processedText.replace(link.placeholder, link.html);
        }
        
        // Tratar quebras de linha
        processedText = processedText.replace(/\n/g, '<br>');
        
        // Verificar e corrigir links após todo o processamento
        // Este regex é projetado especificamente para capturar o caso de erro relatado pelo usuário,
        // onde o texto aparece como: http://url" target="_blank" rel="noopener noreferrer">Link para a aula
        const finalFixRegex = /(&lt;)?(https?:\/\/[^\s<]+)&quot;\s+target=&quot;_blank&quot;\s+rel=&quot;noopener noreferrer&quot;&gt;([^<]+)(&gt;)?/g;
        processedText = processedText.replace(finalFixRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$3</a>');
        
        return processedText;
    }
    
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    showTypingIndicator() {
        const messagesContainer = this.chatWindow.querySelector('.chat-messages');
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        typingIndicator.id = 'typing-indicator';
        
        messagesContainer.appendChild(typingIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    async sendMessage() {
        if (this.isLoading) return;
        
        const input = this.chatWindow.querySelector('.chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Limpar input
        input.value = '';
        
        // Adicionar mensagem do usuário
        this.addMessage(message, 'user');
        
        // Mostrar indicador de digitação
        this.showTypingIndicator();
        this.isLoading = true;
        
        try {
            const response = await fetch('/api/chatbot/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message
                })
            });
            
            const data = await response.json();
            
            // Esconder indicador de digitação
            this.hideTypingIndicator();
            this.isLoading = false;
            
            if (data.error) {
                this.addMessage('Desculpe, ocorreu um erro. Tente novamente mais tarde.', 'bot');
                console.error('Erro na resposta do chatbot:', data.error);
                return;
            }
            
            // Adicionar resposta do bot
            this.addMessage(data.response, 'bot');
            
        } catch (error) {
            // Esconder indicador de digitação
            this.hideTypingIndicator();
            this.isLoading = false;
            
            console.error('Erro ao enviar mensagem:', error);
            this.addMessage('Desculpe, ocorreu um erro. Tente novamente mais tarde.', 'bot');
        }
    }
}

// Inicializar o chatbot quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.membriumChatbot = new MembriumChatbot();
});
