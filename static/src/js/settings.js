document.addEventListener('DOMContentLoaded', function() {
    // Carregar configurações do servidor
    loadSettings();
    
    // Toggle Integration Panels
    setupIntegrationsToggles();
    
    // Setup Template Tags
    setupTemplateTags();
    
    // Setup Form Submissions
    setupFormSubmissions();

    // Setup template variable highlighting
    highlightTemplateVariables('brevoEmailTemplate');
    highlightTemplateVariables('evolutionTemplate');
    
    // Setup Evolution API functionality
    setupEvolutionApiFeatures();
    
    // Setup password toggle for API keys
    setupPasswordToggles();

    // Setup Variables Modal
    setupVariablesModal();

    // Tooltip functionality
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(tooltip => {
        const tooltipText = tooltip.querySelector('.tooltip-text');
        tooltip.addEventListener('mouseenter', () => {
            tooltipText.style.display = 'block';
        });
        tooltip.addEventListener('mouseleave', () => {
            tooltipText.style.display = 'none';
        });
    });

    // Configurar funcionalidades do chatbot
    setupChatbotSettings();
});

/**
 * Carrega as configurações da API
 */
function loadSettings() {
    fetch('/api/settings')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar configurações');
            }
            return response.json();
        })
        .then(data => {
            // Configurações da plataforma
            document.getElementById('platformName').value = data.platform_name || 'MembriumWL';
            
            // Configurações do usuário admin
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.value = document.querySelector('meta[name="admin-email"]')?.content || '';
            }
            
            // Email de suporte
            document.getElementById('supportEmail').value = data.support_email || '';
            
            // Configurações da Brevo
            if (data.brevo) {
                const brevoToggle = document.getElementById('brevoToggle');
                const brevoContent = document.getElementById('brevoContent');
                
                if (data.brevo.enabled) {
                    if (brevoToggle) brevoToggle.checked = true;
                    if (brevoContent) brevoContent.classList.remove('hidden');
                }
                
                if (data.brevo.api_key) {
                    document.getElementById('brevoApiKey').value = data.brevo.api_key;
                }
                
                if (data.brevo.email_subject) {
                    document.getElementById('brevoEmailSubject').value = data.brevo.email_subject;
                }
                
                if (data.brevo.email_template) {
                    document.getElementById('brevoEmailTemplate').value = data.brevo.email_template;
                } else {
                    document.getElementById('brevoEmailTemplate').value = `Olá [[name]],

Parabéns! Você agora tem acesso ao curso [[curso]].

Aqui estão suas credenciais de acesso:

Email: [[email]]
Senha: [[password]]
Link de acesso: [[link]]
Link de acesso rápido: [[fast_link]]

Qualquer dúvida, entre em contato conosco.

Atenciosamente,
Equipe de Suporte`;
                }

                if (data.brevo.sender_name) {
                    document.getElementById('sender_name').value = data.brevo.sender_name;
                }

                if (data.brevo.sender_email) {
                    document.getElementById('sender_email').value = data.brevo.sender_email;
                }
            }
            
            // Configurações da Evolution API
            if (data.evolution) {
                const evolutionToggle = document.getElementById('evolutionToggle');
                const evolutionContent = document.getElementById('evolutionContent');
                
                if (data.evolution.enabled) {
                    if (evolutionToggle) evolutionToggle.checked = true;
                    if (evolutionContent) evolutionContent.classList.remove('hidden');
                }
                
                if (data.evolution.url) {
                    document.getElementById('evolutionUrl').value = data.evolution.url;
                }
                
                if (data.evolution.api_key) {
                    document.getElementById('evolutionApiKey').value = data.evolution.api_key;
                }
                
                if (data.evolution.message_template) {
                    document.getElementById('evolutionTemplate').value = data.evolution.message_template;
                } else {
                    document.getElementById('evolutionTemplate').value = `Olá [[first_name]]! 👋

Seu acesso ao curso [[curso]] foi liberado! ✅

*Acesse com os dados abaixo:*

📧 *Login:* [[email]]
🔑 *Senha:* [[password]]

🌐 *Link de acesso comum:* [[link]]
🔑 *Link de acesso rápido:* [[fast_link]]

Se precisar de ajuda, estamos à disposição!`;
                }
                
                // Carregar versão e instância da Evolution API
                if (data.evolution.version) {
                    const versionSelect = document.getElementById('evolutionVersion');
                    if (versionSelect) {
                        versionSelect.value = data.evolution.version;
                    }
                }
                
                if (data.evolution.instance) {
                    const instanceSelect = document.getElementById('evolutionInstance');
                    if (instanceSelect) {
                        // Adicionar a instância salva como opção
                        const option = document.createElement('option');
                        option.value = data.evolution.instance;
                        option.textContent = data.evolution.instance;
                        
                        // Limpar opções existentes exceto a primeira
                        while (instanceSelect.options.length > 1) {
                            instanceSelect.remove(1);
                        }
                        
                        instanceSelect.appendChild(option);
                        instanceSelect.value = data.evolution.instance;
                    }
                }
            }
            
            // Configurações da GROQ AI
            if (data.groq) {
                const groqToggle = document.getElementById('groqToggle');
                const groqContent = document.getElementById('groqContent');
                
                if (data.groq.enabled) {
                    if (groqToggle) groqToggle.checked = true;
                    if (groqContent) groqContent.classList.remove('hidden');
                }
                
                if (data.groq.api_key) {
                    document.getElementById('groqApiKey').value = data.groq.api_key;
                }
            }
            
            // Configurações da OpenAI
            if (data.openai) {
                const openaiToggle = document.getElementById('openaiToggle');
                const openaiContent = document.getElementById('openaiContent');
                
                if (data.openai.enabled) {
                    if (openaiToggle) openaiToggle.checked = true;
                    if (openaiContent) openaiContent.classList.remove('hidden');
                }
                
                if (data.openai.api_key) {
                    document.getElementById('openaiApiKey').value = data.openai.api_key;
                }
            }
            
            // IMPORTANTE: Verificar dependências do chatbot APÓS carregar todos os dados da API
            // Isso corrige o problema do toggle do chatbot não ser habilitado corretamente
            checkChatbotDependencies();
        })
        .catch(error => {
            console.error('Erro ao carregar configurações:', error);
            showNotification('Falha ao carregar configurações. Tente novamente.', 'error');
        });
}

/**
 * Setup toggle behavior for integration sections
 */
function setupIntegrationsToggles() {
    const toggles = document.querySelectorAll('.integration-toggle input[type="checkbox"]');
    
    toggles.forEach(toggle => {
        const targetId = toggle.id.replace('Toggle', 'Content');
        const targetContent = document.getElementById(targetId);
        
        if (!targetContent) return;
        
        // Estado inicial
        if (toggle.checked) {
            targetContent.classList.remove('hidden');
        } else {
            targetContent.classList.add('hidden');
        }
        
        // Manipular eventos
        toggle.addEventListener('change', function() {
            // Caso especial para o chatbot que precisa verificar dependências
            if (this.id === 'chatbotToggle') {
                if (this.checked) {
                    // Verificar dependências do chatbot
                    if (checkChatbotDependencies()) {
                        targetContent.classList.remove('hidden');
                    } else {
                        this.checked = false;
                    }
                } else {
                    targetContent.classList.add('hidden');
                    
                    // Enviar imediatamente o estado desativado para o servidor
                    fetch('/api/chatbot/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enabled: false })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showNotification('Chatbot desativado com sucesso!');
                        } else {
                            showNotification(data.error || 'Erro ao desativar chatbot.', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Erro:', error);
                        showNotification('Erro ao desativar chatbot. Tente novamente.', 'error');
                    });
                }
                return;
            }
            
            // Comportamento padrão para outros toggles
            if (this.checked) {
                targetContent.classList.remove('hidden');
            } else {
                targetContent.classList.add('hidden');
            }
            
            // Automatically submit the form when toggle changes
            const formId = this.id.replace('Toggle', 'Settings');
            const form = document.getElementById(formId);
            if (form) {
                // Trigger submit event on the form
                const submitEvent = new Event('submit', { cancelable: true });
                form.dispatchEvent(submitEvent);
            }
        });
    });
}

/**
 * Setup template tags click behavior
 */
function setupTemplateTags() {
    // Configurando o comportamento de click para template tags
    const templateTags = document.querySelectorAll('.template-tag');
    
    templateTags.forEach(tag => {
        tag.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const tagValue = this.textContent;
            
            // Encontra o elemento alvo (textarea ou input)
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                // Salva a posição atual do cursor
                const startPos = targetElement.selectionStart;
                const endPos = targetElement.selectionEnd;
                
                // Obtém o texto atual
                const text = targetElement.value;
                const before = text.substring(0, startPos);
                const after = text.substring(endPos);
                
                // Insere a tag na posição do cursor
                targetElement.value = before + tagValue + after;
                
                // Restaura o foco e posiciona o cursor após a tag inserida
                targetElement.focus();
                targetElement.selectionStart = startPos + tagValue.length;
                targetElement.selectionEnd = startPos + tagValue.length;
                
                // Feedback visual
                this.classList.add('active');
                setTimeout(() => {
                    this.classList.remove('active');
                }, 300);
            }
        });
    });
}

/**
 * Insert template tag into textareas
 * @param {string} elementId - ID of the target element
 * @param {string} tag - Template tag to insert
 */
function insertTemplateTag(elementId, tag) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startPos = element.selectionStart;
    const endPos = element.selectionEnd;
    const text = element.value;
    const before = text.substring(0, startPos);
    const after = text.substring(endPos);
    
    element.value = before + tag + after;
    element.focus();
    element.selectionStart = startPos + tag.length;
    element.selectionEnd = startPos + tag.length;
    
    // Add visual feedback
    const tagElements = document.querySelectorAll('.template-tag');
    tagElements.forEach(el => {
        if (el.innerText === tag) {
            el.classList.add('active');
            setTimeout(() => {
                el.classList.remove('active');
            }, 300);
        }
    });
}

/**
 * Highlight template variables in textareas
 * @param {string} elementId - ID of the textarea element
 */
function highlightTemplateVariables(elementId) {
    const textarea = document.getElementById(elementId);
    if (!textarea) return;

    // Available variables
    const variables = ['[[name]]', '[[first_name]]', '[[email]]', '[[link]]', '[[password]]', '[[curso]]', '[[fast_link]]'];
    
    // Create a preview div
    let preview = document.getElementById(`${elementId}-preview`);
    if (!preview) {
        preview = document.createElement('div');
        preview.id = `${elementId}-preview`;
        preview.className = 'form-control h-48 overflow-y-auto';
        textarea.parentNode.insertBefore(preview, textarea.nextSibling);
    }

    // Update function
    function updatePreview() {
        let html = textarea.value;
        variables.forEach(variable => {
            html = html.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
                `<span class="template-highlight">${variable}</span>`);
        });
        html = html.replace(/\n/g, '<br>');
        preview.innerHTML = html;
    }

    // Initial update
    updatePreview();

    // Initially hide textarea and show preview
    textarea.style.display = 'none';
    preview.style.display = 'block';

    // Show textarea when preview is clicked
    preview.addEventListener('click', () => {
        preview.style.display = 'none';
        textarea.style.display = 'block';
        textarea.focus();
    });

    // Show preview when textarea is not focused
    textarea.addEventListener('blur', () => {
        textarea.style.display = 'none';
        preview.style.display = 'block';
        updatePreview(); // Update preview before showing it
    });

    // Update preview when content changes
    textarea.addEventListener('input', updatePreview);
}

/**
 * Setup Evolution API specific features
 */
function setupEvolutionApiFeatures() {
    // URL validation and cleaning
    const evolutionUrlInput = document.getElementById('evolutionUrl');
    const urlErrorMessage = document.getElementById('urlError');
    
    if (evolutionUrlInput) {
        evolutionUrlInput.addEventListener('blur', function() {
            validateEvolutionUrl(this.value);
        });
    }
    
    // Version detection button
    const detectVersionBtn = document.getElementById('detectVersionBtn');
    if (detectVersionBtn) {
        detectVersionBtn.addEventListener('click', function() {
            detectEvolutionVersion();
        });
    }
    
    // Instance fetch button
    const fetchInstancesBtn = document.getElementById('fetchInstancesBtn');
    if (fetchInstancesBtn) {
        fetchInstancesBtn.addEventListener('click', function() {
            fetchEvolutionInstances();
        });
    }
}

/**
 * Validates and cleans the Evolution API URL
 * @param {string} url - URL to validate
 * @returns {string|null} - Cleaned URL or null if invalid
 */
function validateEvolutionUrl(url) {
    const urlErrorMessage = document.getElementById('urlError');
    const urlInput = document.getElementById('evolutionUrl');
    
    if (!url) {
        if (urlErrorMessage) urlErrorMessage.classList.add('hidden');
        return null;
    }
    
    try {
        const parsedUrl = new URL(url);
        
        // Remove path, query, and hash
        const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        
        // Update input with cleaned URL
        if (urlInput && cleanUrl !== url) {
            urlInput.value = cleanUrl;
        }
        
        if (urlErrorMessage) urlErrorMessage.classList.add('hidden');
        return cleanUrl;
    } catch (e) {
        if (urlErrorMessage) {
            urlErrorMessage.textContent = 'URL inválida. Use o formato: https://meudominio.com';
            urlErrorMessage.classList.remove('hidden');
        }
        return null;
    }
}

/**
 * Detects the Evolution API version
 */
function detectEvolutionVersion() {
    const urlInput = document.getElementById('evolutionUrl');
    const versionSelect = document.getElementById('evolutionVersion');
    const versionInfo = document.getElementById('versionInfo');
    
    if (!urlInput || !versionSelect || !versionInfo) return;
    
    const url = validateEvolutionUrl(urlInput.value);
    
    if (!url) {
        showNotification('URL inválida ou não informada. Por favor, informe uma URL válida.', 'error');
        return;
    }
    
    // Show loading state
    versionInfo.textContent = 'Detectando versão...';
    versionInfo.classList.remove('hidden', 'text-green-500', 'text-red-500');
    versionInfo.classList.add('text-blue-500');
    
    // Fetch version information
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 200 && data.version) {
                // Determine version category
                const version = data.version;
                const versionValue = isEvolutionV2(version) ? '2.x.x' : '1.8.x';
                
                // Update select
                versionSelect.value = versionValue;
                
                // Show success message
                versionInfo.textContent = `Versão detectada: ${version} (${versionValue})`;
                versionInfo.classList.remove('text-blue-500', 'text-red-500');
                versionInfo.classList.add('text-green-500', 'font-medium');
                versionInfo.classList.remove('hidden');
                
                showNotification(`Versão da Evolution API detectada: ${version}`, 'success');
                
                // Fetch instances if API key is provided
                const apiKeyInput = document.getElementById('evolutionApiKey');
                if (apiKeyInput && apiKeyInput.value) {
                    fetchEvolutionInstances();
                }
            } else {
                throw new Error('Versão não encontrada na resposta');
            }
        })
        .catch(error => {
            console.error('Erro ao detectar versão:', error);
            versionInfo.textContent = `Falha ao detectar versão: ${error.message}`;
            versionInfo.classList.remove('text-blue-500', 'text-green-500', 'hidden');
            versionInfo.classList.add('text-red-500');
            showNotification('Não foi possível detectar a versão da API. Verifique se a URL está correta e a API está acessível.', 'error');
        });
}

/**
 * Check if version is 2.x.x or higher
 * @param {string} version - Version string (e.g. "1.8.5" or "2.0.1")
 * @returns {boolean} - True if version is 2.x.x or higher
 */
function isEvolutionV2(version) {
    try {
        const majorVersion = parseInt(version.split('.')[0], 10);
        return majorVersion >= 2;
    } catch (e) {
        return false;
    }
}

/**
 * Fetches available instances from Evolution API
 */
function fetchEvolutionInstances() {
    const urlInput = document.getElementById('evolutionUrl');
    const apiKeyInput = document.getElementById('evolutionApiKey');
    const instanceSelect = document.getElementById('evolutionInstance');
    
    if (!urlInput || !apiKeyInput || !instanceSelect) return;
    
    const url = validateEvolutionUrl(urlInput.value);
    const apiKey = apiKeyInput.value.trim();
    
    if (!url) {
        showNotification('URL inválida ou não informada. Por favor, informe uma URL válida.', 'error');
        return;
    }
    
    if (!apiKey) {
        showNotification('API Key não informada. Por favor, informe sua API Key.', 'error');
        return;
    }
    
    // Clear existing options except for the first placeholder
    while (instanceSelect.options.length > 1) {
        instanceSelect.options.remove(1);
    }
    
    // Add loading option
    const loadingOption = document.createElement('option');
    loadingOption.text = 'Carregando instâncias...';
    loadingOption.disabled = true;
    instanceSelect.add(loadingOption);
    instanceSelect.value = loadingOption.value;
    
    // Fetch instances
    fetch(`${url}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
            'apikey': apiKey
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Remove loading option
        instanceSelect.remove(instanceSelect.options.length - 1);
        
        if (Array.isArray(data) && data.length > 0) {
            data.forEach(item => {
                if (item.instance && item.instance.instanceName) {
                    const option = document.createElement('option');
                    option.value = item.instance.instanceName;
                    option.text = item.instance.instanceName;
                    instanceSelect.add(option);
                }
            });
            
            showNotification(`${data.length} instância(s) encontrada(s)`, 'success');
        } else {
            showNotification('Nenhuma instância encontrada. Verifique sua API key ou crie uma nova instância.', 'error');
        }
    })
    .catch(error => {
        console.error('Erro ao buscar instâncias:', error);
        instanceSelect.remove(instanceSelect.options.length - 1);
        showNotification(`Erro ao buscar instâncias: ${error.message}`, 'error');
    });
}

/**
 * Setup form submissions with API connections
 */
function setupFormSubmissions() {
    // Platform Settings Form
    const platformForm = document.getElementById('platformSettings');
    if (platformForm) {
        platformForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('platform_name', document.getElementById('platformName').value);
            
            fetch('/api/settings/platform', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Configurações da plataforma salvas com sucesso!', 'success');
                } else {
                    showNotification(data.message || 'Erro ao salvar as configurações.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao salvar as configurações. Tente novamente.', 'error');
            });
        });
    }
    
    // User Settings Form
    const userForm = document.getElementById('userSettings');
    if (userForm) {
        userForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('userEmail').value;
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            
            // Validação simples
            if (currentPassword && !newPassword) {
                showNotification('Informe a nova senha', 'error');
                return;
            }
            
            if (!currentPassword && newPassword) {
                showNotification('Informe a senha atual', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('email', email);
            if (currentPassword) formData.append('current_password', currentPassword);
            if (newPassword) formData.append('new_password', newPassword);
            
            fetch('/api/settings/admin', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Informações do usuário atualizadas com sucesso!', 'success');
                    // Limpar campos de senha após submissão bem-sucedida
                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                } else {
                    showNotification(data.message || 'Erro ao atualizar informações do usuário.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao atualizar informações do usuário. Tente novamente.', 'error');
            });
        });
    }
    
    // Support Email Form
    const supportForm = document.getElementById('supportSettings');
    if (supportForm) {
        supportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('support_email', document.getElementById('supportEmail').value);
            
            fetch('/api/settings/support', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Email de suporte salvo com sucesso!', 'success');
                } else {
                    showNotification(data.message || 'Erro ao salvar email de suporte.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao salvar email de suporte. Tente novamente.', 'error');
            });
        });
    }
    
    // Brevo Settings Form
    const brevoForm = document.getElementById('brevoSettings');
    if (brevoForm) {
        brevoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const brevoToggle = document.getElementById('brevoToggle');
            const enabled = brevoToggle.checked;
            const apiKey = document.getElementById('brevoApiKey').value;
            const emailSubject = document.getElementById('brevoEmailSubject').value;
            const emailTemplate = document.getElementById('brevoEmailTemplate').value;
            const senderName = document.getElementById('sender_name').value;
            const senderEmail = document.getElementById('sender_email').value;
            
            if (enabled && !apiKey) {
                showNotification('API Key da Brevo é obrigatória quando a integração está ativada', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('enabled', enabled);
            formData.append('api_key', apiKey);
            formData.append('email_subject', emailSubject);
            formData.append('email_template', emailTemplate);
            formData.append('sender_name', senderName);
            formData.append('sender_email', senderEmail);
            
            fetch('/api/settings/brevo', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Configurações da Brevo salvas com sucesso!', 'success');
                } else {
                    showNotification(data.message || 'Erro ao salvar configurações da Brevo.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao salvar configurações da Brevo. Tente novamente.', 'error');
            });
        });
    }
    
    // Evolution Settings Form
    const evolutionForm = document.getElementById('evolutionSettings');
    if (evolutionForm) {
        evolutionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const evolutionToggle = document.getElementById('evolutionToggle');
            const enabled = evolutionToggle.checked;
            const url = document.getElementById('evolutionUrl').value;
            const apiKey = document.getElementById('evolutionApiKey').value;
            const messageTemplate = document.getElementById('evolutionTemplate').value;
            const version = document.getElementById('evolutionVersion').value;
            const instance = document.getElementById('evolutionInstance').value;
            
            if (enabled) {
                if (!url) {
                    showNotification('URL da Evolution API é obrigatória quando a integração está ativada', 'error');
                    return;
                }
                if (!apiKey) {
                    showNotification('API Key da Evolution API é obrigatória quando a integração está ativada', 'error');
                    return;
                }
                if (!version) {
                    showNotification('Versão da Evolution API é obrigatória quando a integração está ativada', 'error');
                    return;
                }
                if (!instance) {
                    showNotification('Instância da Evolution API é obrigatória quando a integração está ativada', 'error');
                    return;
                }
            }
            
            const formData = new FormData();
            formData.append('enabled', enabled);
            formData.append('url', validateEvolutionUrl(url) || '');
            formData.append('api_key', apiKey);
            formData.append('message_template', messageTemplate);
            formData.append('version', version);
            formData.append('instance', instance);
            
            fetch('/api/settings/evolution', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Configurações da Evolution API salvas com sucesso!', 'success');
                } else {
                    showNotification(data.message || 'Erro ao salvar configurações da Evolution API.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao salvar configurações da Evolution API. Tente novamente.', 'error');
            });
        });
    }
    
    // GROQ AI Settings Form
    const groqForm = document.getElementById('groqSettings');
    if (groqForm) {
        groqForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const groqToggle = document.getElementById('groqToggle');
            const enabled = groqToggle.checked;
            const apiKey = document.getElementById('groqApiKey').value;
            
            if (enabled && !apiKey) {
                showNotification('API Key da GROQ AI é obrigatória quando a integração está ativada', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('enabled', enabled);
            formData.append('api_key', apiKey);
            
            fetch('/api/settings/groq', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Configurações da GROQ AI salvas com sucesso!', 'success');
                } else {
                    showNotification(data.message || 'Erro ao salvar configurações da GROQ AI.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao salvar configurações da GROQ AI. Tente novamente.', 'error');
            });
        });
    }
    
    // OpenAI Settings Form
    const openaiForm = document.getElementById('openaiSettings');
    if (openaiForm) {
        openaiForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const openaiToggle = document.getElementById('openaiToggle');
            const enabled = openaiToggle.checked;
            const apiKey = document.getElementById('openaiApiKey').value;
            
            if (enabled && !apiKey) {
                showNotification('API Key da OpenAI é obrigatória quando a integração está ativada', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('enabled', enabled);
            formData.append('api_key', apiKey);
            
            fetch('/api/settings/openai', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message || 'Configurações da OpenAI salvas com sucesso!', 'success');
                } else {
                    showNotification(data.message || 'Erro ao salvar configurações da OpenAI.', 'error');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                showNotification('Erro ao salvar configurações da OpenAI. Tente novamente.', 'error');
            });
        });
    }
}

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - Type of notification ('success' or 'error')
 */
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all transform translate-x-0 ${
        type === 'success' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' : 'bg-red-50 text-red-800 border-l-4 border-red-500'
    }`;
    
    // Add icon based on type
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    
    notification.innerHTML = `
        <div class="flex items-center">
            <div class="flex-shrink-0">
                <i data-lucide="${iconName}" class="h-5 w-5 ${type === 'success' ? 'text-green-500' : 'text-red-500'}"></i>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium">${message}</p>
            </div>
            <div class="ml-auto pl-3">
                <div class="-mx-1.5 -my-1.5">
                    <button type="button" class="notification-close inline-flex rounded-md p-1.5 ${
                        type === 'success' ? 'text-green-500 hover:bg-green-100' : 'text-red-500 hover:bg-red-100'
                    } focus:outline-none">
                        <i data-lucide="x" class="h-4 w-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Initialize Lucide icons for the notification
    lucide.createIcons({
        attrs: {
            'stroke-width': 2,
            'stroke': 'currentColor',
        },
        elements: [notification]
    });
    
    // Setup close button
    const closeButton = notification.querySelector('.notification-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            notification.classList.add('opacity-0', '-translate-x-full');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

/**
 * Setup password toggle functionality for API keys
 */
function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            
            if (!targetInput) return;
            
            // Toggle input type between password and text
            const currentType = targetInput.getAttribute('type');
            targetInput.setAttribute('type', currentType === 'password' ? 'text' : 'password');
            
            // Change icon between eye and eye-off
            const icon = this.querySelector('i');
            if (icon) {
                const currentIcon = icon.getAttribute('data-lucide');
                const newIcon = currentIcon === 'eye' ? 'eye-off' : 'eye';
                icon.setAttribute('data-lucide', newIcon);
                
                // Recreate the icon with Lucide
                icon.innerHTML = '';
                lucide.createIcons({
                    elements: [icon],
                    attrs: {
                        'stroke-width': 2,
                        'stroke': 'currentColor',
                    }
                });
            }
        });
    });
}

/**
 * Setup Variables Modal functionality
 */
function setupVariablesModal() {
    const modal = document.getElementById('variablesModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModalBtn = document.getElementById('closeVariablesModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const learnMoreBtns = document.querySelectorAll('.learn-more-btn');
    
    if (!modal) return;
    
    // Function to open the modal
    const openModal = () => {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        
        // Animation
        const modalContent = modal.querySelector('.bg-white');
        modalContent.classList.add('animate-fadeIn');
        
        // Initialize Lucide icons in the modal
        lucide.createIcons({
            attrs: {
                'stroke-width': 2,
                'stroke': 'currentColor',
            },
            elements: [modal]
        });
    };
    
    // Function to close the modal
    const closeModal = () => {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scrolling
    };
    
    // Event listeners for opening the modal
    learnMoreBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tooltip from closing
            openModal();
        });
    });
    
    // Event listeners for closing the modal
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (closeModalButton) closeModalButton.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
    
    // Stop propagation on modal content
    const modalContent = modal.querySelector('.bg-white');
    if (modalContent) {
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Função global para inserir tags nos templates
window.insertTemplateTag = insertTemplateTag;

// Função global para verificar dependências do chatbot
function checkChatbotDependencies() {
    const groqEnabled = document.getElementById('groqToggle').checked;
    const openaiEnabled = document.getElementById('openaiToggle').checked;
    const chatbotRequiredApiMessage = document.getElementById('chatbotRequiredApiMessage');
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotContent = document.getElementById('chatbotContent');
    
    if (!groqEnabled && !openaiEnabled) {
        // Se não há APIs configuradas, desabilitar o toggle do chatbot
        if (chatbotRequiredApiMessage) {
            chatbotRequiredApiMessage.classList.remove('hidden');
        }
        if (chatbotToggle) {
            chatbotToggle.disabled = true;
            if (chatbotToggle.checked) {
                chatbotToggle.checked = false;
                if (chatbotContent) {
                    chatbotContent.classList.add('hidden');
                }
            }
        }
        return false;
    } else {
        // Se há pelo menos uma API configurada, habilitar o toggle do chatbot
        if (chatbotRequiredApiMessage) {
            chatbotRequiredApiMessage.classList.add('hidden');
        }
        if (chatbotToggle) {
            chatbotToggle.disabled = false;
            
            // Não alteramos o estado checked do toggle aqui,
            // pois isso deve ser determinado pelos dados da API
        }
        return true;
    }
}

function setupChatbotSettings() {
    const chatbotProvider = document.getElementById('chatbotProvider');
    const chatbotModel = document.getElementById('chatbotModel');
    const chatbotSettings = document.getElementById('chatbotSettings');
    const chatbotPreview = document.getElementById('chatbotPreview');
    const chatbotRequiredApiMessage = document.getElementById('chatbotRequiredApiMessage');
    const internalKnowledgeToggle = document.getElementById('internalKnowledgeToggle');
    
    // Eventos dos providers de IA
    document.getElementById('groqToggle').addEventListener('change', checkChatbotDependencies);
    document.getElementById('openaiToggle').addEventListener('change', checkChatbotDependencies);
    
    // Mudança no provider do chatbot
    if (chatbotProvider) {
        chatbotProvider.addEventListener('change', function() {
            const provider = this.value;
            const providerWarning = document.getElementById('providerWarning');
            
            chatbotModel.innerHTML = '<option value="">Selecione um modelo</option>';
            
            if (provider === 'groq') {
                const groqEnabled = document.getElementById('groqToggle').checked;
                if (!groqEnabled) {
                    providerWarning.textContent = 'É necessário ativar e configurar o GROQ primeiro.';
                    providerWarning.classList.remove('hidden');
                    chatbotModel.disabled = true;
                    return;
                } else {
                    providerWarning.classList.add('hidden');
                    chatbotModel.disabled = false;
                }
                
                // Modelos GROQ
                const groqModels = [
                    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 com 70b (recomendado)', description: 'Modelo versátil com forte raciocínio' },
                    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 com 70b', description: 'Alta capacidade de análise e síntese' },
                    { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 com 90b', description: 'Modelo de grande capacidade' },
                    { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 com 32b', description: 'Bom equilíbrio de velocidade e qualidade' },
                    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 com 8b', description: 'Mais leve e rápido para respostas imediatas' }
                ];
                
                groqModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    chatbotModel.appendChild(option);
                });
                
                // Definir Llama 3.3 como valor inicial
                chatbotModel.value = 'llama-3.3-70b-versatile';
                
            } else if (provider === 'openai') {
                const openaiEnabled = document.getElementById('openaiToggle').checked;
                if (!openaiEnabled) {
                    providerWarning.textContent = 'É necessário ativar e configurar a OpenAI primeiro.';
                    providerWarning.classList.remove('hidden');
                    chatbotModel.disabled = true;
                    return;
                } else {
                    providerWarning.classList.add('hidden');
                    chatbotModel.disabled = false;
                }
                
                // Modelos OpenAI
                const openaiModels = [
                    { id: 'gpt-4o-mini', name: 'GPT-4O Mini (recomendado)', description: 'Versão mais rápida do GPT-4O' },
                    { id: 'gpt-4o', name: 'GPT-4O', description: 'Modelo mais avançado' },
                    { id: 'gpt-o1', name: 'GPT-O1', description: 'Bom equilíbrio entre velocidade e qualidade' },
                    { id: 'gpt-o1-mini', name: 'GPT-O1 Mini', description: 'Modelo compacto e rápido' },
                    { id: 'gpt-o3-mini', name: 'GPT-O3 Mini', description: 'Modelo mais leve e rápido' }
                ];
                
                openaiModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    chatbotModel.appendChild(option);
                });
                
                // Definir GPT-4O Mini como valor inicial
                chatbotModel.value = 'gpt-4o-mini';
            } else {
                chatbotModel.disabled = true;
            }
            
            updateChatbotPreview();
        });
    }
    
    // Atualizar preview do chatbot
    function updateChatbotPreview() {
        const name = document.getElementById('chatbotName').value || 'Assistente Virtual';
        const message = document.getElementById('chatbotWelcomeMessage').value || 'Olá! Como posso ajudar com seus estudos hoje?';
        const avatarPreview = document.getElementById('avatarPreview');
        const previewName = document.getElementById('previewChatbotName');
        const previewMessage = document.getElementById('previewChatbotMessage');
        const previewAvatar = document.getElementById('previewChatbotAvatar');
        
        if (name || message) {
            chatbotPreview.classList.remove('hidden');
            previewName.textContent = name;
            previewMessage.textContent = message;
            
            // Verificar se há avatar
            if (avatarPreview.querySelector('img') && avatarPreview.querySelector('img').src) {
                previewAvatar.src = avatarPreview.querySelector('img').src;
                previewAvatar.classList.remove('hidden');
                chatbotPreview.querySelector('[data-lucide="user"]').classList.add('hidden');
            } else {
                previewAvatar.classList.add('hidden');
                chatbotPreview.querySelector('[data-lucide="user"]').classList.remove('hidden');
            }
        } else {
            chatbotPreview.classList.add('hidden');
        }
    }
    
    // Atualizar preview ao digitar
    document.getElementById('chatbotName').addEventListener('input', updateChatbotPreview);
    document.getElementById('chatbotWelcomeMessage').addEventListener('input', updateChatbotPreview);
    
    // Upload de avatar
    const chatbotAvatar = document.getElementById('chatbotAvatar');
    if (chatbotAvatar) {
        chatbotAvatar.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const avatarPreview = document.getElementById('avatarPreview');
                    
                    // Remover ícone e adicionar imagem
                    avatarPreview.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.classList.add('w-full', 'h-full', 'object-cover');
                    avatarPreview.appendChild(img);
                    
                    updateChatbotPreview();
                }
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Enviar configurações do chatbot
    if (chatbotSettings) {
        chatbotSettings.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Verifica se está ativado
            const enabled = chatbotToggle.checked;
            
            // Se desativado, apenas salva essa informação
            if (!enabled) {
                const data = { enabled: false };
                
                fetch('/api/chatbot/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Configurações do chatbot atualizadas com sucesso!');
                    } else {
                        showNotification(data.error || 'Erro ao atualizar configurações do chatbot.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Erro:', error);
                    showNotification('Erro ao salvar configurações do chatbot.', 'error');
                });
                
                return;
            }
            
            // Validar campos obrigatórios
            const provider = chatbotProvider.value;
            const model = chatbotModel.value;
            
            if (!provider) {
                showNotification('Selecione um provedor de IA.', 'error');
                return;
            }
            
            if (!model) {
                showNotification('Selecione um modelo de IA.', 'error');
                return;
            }
            
            // Preparar dados
            const formData = new FormData();
            
            // Se tiver um arquivo de avatar, fazer upload primeiro
            if (chatbotAvatar.files.length > 0) {
                formData.append('file', chatbotAvatar.files[0]);
                
                fetch('/api/chatbot/avatar', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        saveChatbotSettings(data.url);
                    } else {
                        showNotification(data.error || 'Erro ao fazer upload do avatar.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Erro:', error);
                    showNotification('Erro ao fazer upload do avatar.', 'error');
                });
            } else {
                // Se não tiver avatar novo, salvar as configurações direto
                saveChatbotSettings();
            }
        });
    }
    
    // Função para salvar configurações do chatbot
    function saveChatbotSettings(avatarUrl = null) {
        const data = {
            enabled: chatbotToggle.checked,
            provider: chatbotProvider.value,
            model: chatbotModel.value,
            name: document.getElementById('chatbotName').value,
            welcome_message: document.getElementById('chatbotWelcomeMessage').value,
            use_internal_knowledge: document.getElementById('internalKnowledgeToggle').checked
        };
        
        // Se tiver avatar novo, usar ele
        if (avatarUrl) {
            data.avatar = avatarUrl;
        } else {
            // Se já tiver avatar carregado previamente
            const previewImg = document.getElementById('avatarPreview').querySelector('img');
            if (previewImg && previewImg.getAttribute('data-original-src')) {
                data.avatar = previewImg.getAttribute('data-original-src');
            }
        }
        
        fetch('/api/chatbot/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Configurações do chatbot atualizadas com sucesso!');
            } else {
                showNotification(data.error || 'Erro ao atualizar configurações do chatbot.', 'error');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            showNotification('Erro ao salvar configurações do chatbot.', 'error');
        });
    }
    
    // Carregar configurações do chatbot
    loadChatbotSettings();
}

// Carregar configurações do chatbot
function loadChatbotSettings() {
    fetch('/api/chatbot/settings')
    .then(response => response.json())
    .then(data => {
        if (!data.error) {
            // Definir estados dos toggles
            document.getElementById('chatbotToggle').checked = data.enabled;
            if (data.enabled) {
                document.getElementById('chatbotContent').classList.remove('hidden');
            } else {
                document.getElementById('chatbotContent').classList.add('hidden');
            }
            
            // Preencher campos
            document.getElementById('chatbotName').value = data.name || '';
            document.getElementById('chatbotWelcomeMessage').value = data.welcome_message || '';
            document.getElementById('internalKnowledgeToggle').checked = data.use_internal_knowledge || false;
            
            // Selecionar provider e modelo
            const providerSelect = document.getElementById('chatbotProvider');
            const modelSelect = document.getElementById('chatbotModel');
            
            // Primeiro garantir que o provedor escolhido esteja ativado
            if (data.provider === 'groq' && !document.getElementById('groqToggle').checked) {
                document.getElementById('providerWarning').textContent = 'É necessário ativar e configurar o GROQ primeiro.';
                document.getElementById('providerWarning').classList.remove('hidden');
                modelSelect.disabled = true;
            } else if (data.provider === 'openai' && !document.getElementById('openaiToggle').checked) {
                document.getElementById('providerWarning').textContent = 'É necessário ativar e configurar a OpenAI primeiro.';
                document.getElementById('providerWarning').classList.remove('hidden');
                modelSelect.disabled = true;
            } else if (data.provider) {
                // Se o provedor estiver ativado, configurar corretamente
                providerSelect.value = data.provider;
                document.getElementById('providerWarning').classList.add('hidden');
                modelSelect.disabled = false;
                
                // Carregar os modelos manualmente com base no provedor selecionado
                modelSelect.innerHTML = '<option value="">Selecione um modelo</option>';
                
                if (data.provider === 'groq') {
                    // Modelos GROQ
                    const groqModels = [
                        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 com 70b (recomendado)', description: 'Modelo versátil com forte raciocínio' },
                        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 com 70b', description: 'Alta capacidade de análise e síntese' },
                        { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 com 90b', description: 'Modelo de grande capacidade' },
                        { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 com 32b', description: 'Bom equilíbrio de velocidade e qualidade' },
                        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 com 8b', description: 'Mais leve e rápido para respostas imediatas' }
                    ];
                    
                    groqModels.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        modelSelect.appendChild(option);
                    });
                    
                    // Se não tiver modelo definido, selecionar o Llama 3.3 por padrão
                    if (!data.model) {
                        modelSelect.value = 'llama-3.3-70b-versatile';
                    } else {
                        modelSelect.value = data.model;
                    }
                    
                } else if (data.provider === 'openai') {
                    // Modelos OpenAI
                    const openaiModels = [
                        { id: 'gpt-4o-mini', name: 'GPT-4O Mini (recomendado)', description: 'Versão mais rápida do GPT-4O' },
                        { id: 'gpt-4o', name: 'GPT-4O', description: 'Modelo mais avançado' },
                        { id: 'gpt-o1', name: 'GPT-O1', description: 'Bom equilíbrio entre velocidade e qualidade' },
                        { id: 'gpt-o1-mini', name: 'GPT-O1 Mini', description: 'Modelo compacto e rápido' },
                        { id: 'gpt-o3-mini', name: 'GPT-O3 Mini', description: 'Modelo mais leve e rápido' }
                    ];
                    
                    openaiModels.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        modelSelect.appendChild(option);
                    });
                    
                    // Se não tiver modelo definido, selecionar o GPT-4O Mini por padrão
                    if (!data.model) {
                        modelSelect.value = 'gpt-4o-mini';
                    } else {
                        modelSelect.value = data.model;
                    }
                }
            }
            
            // Avatar
            if (data.avatar) {
                const avatarPreview = document.getElementById('avatarPreview');
                avatarPreview.innerHTML = '';
                const img = document.createElement('img');
                img.src = data.avatar;
                img.setAttribute('data-original-src', data.avatar);
                img.classList.add('w-full', 'h-full', 'object-cover');
                avatarPreview.appendChild(img);
                
                // Atualizar preview
                const previewAvatar = document.getElementById('previewChatbotAvatar');
                previewAvatar.src = data.avatar;
                previewAvatar.classList.remove('hidden');
                document.getElementById('chatbotPreview').querySelector('[data-lucide="user"]').classList.add('hidden');
            }
            
            // Atualizar preview
            const name = data.name || 'Assistente Virtual';
            const message = data.welcome_message || 'Olá! Como posso ajudar com seus estudos hoje?';
            
            if (name || message) {
                document.getElementById('chatbotPreview').classList.remove('hidden');
                document.getElementById('previewChatbotName').textContent = name;
                document.getElementById('previewChatbotMessage').textContent = message;
            }
        }
    })
    .catch(error => {
        console.error('Erro ao carregar configurações do chatbot:', error);
    });
}