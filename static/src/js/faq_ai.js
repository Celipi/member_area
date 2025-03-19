/**
 * FAQ AI Generation JavaScript
 */

// Global variables for AI generation
let selectedAIModel = 'llama-3.3-70b-versatile';
let selectedAIProvider = 'groq';
let aiGeneratedFAQs = [];

document.addEventListener('DOMContentLoaded', function() {
    // Setup AI-related event listeners when DOM is loaded
    setupAIEventListeners();
});

/**
 * Set up event listeners for AI functionality
 */
function setupAIEventListeners() {
    // Generate AI button in FAQ modal
    const generateAIButton = document.getElementById('generateAIButton');
    if (generateAIButton) {
        generateAIButton.addEventListener('click', function() {
            // Check if lesson is selected
            const lessonId = document.getElementById('formLessonSelect').value;
            if (!lessonId) {
                showToast('Por favor, selecione uma aula primeiro', 'error');
                return;
            }
            openAIModal(lessonId);
        });
        
        // Initially disable the AI button until a lesson is selected
        generateAIButton.disabled = true;
    }
    
    // Lesson select change to enable/disable AI button
    const lessonSelect = document.getElementById('formLessonSelect');
    if (lessonSelect) {
        lessonSelect.addEventListener('change', function() {
            const generateAIButton = document.getElementById('generateAIButton');
            generateAIButton.disabled = !this.value;
        });
    }
    
    // Start generation button
    const startGenerationButton = document.getElementById('startGenerationButton');
    if (startGenerationButton) {
        startGenerationButton.addEventListener('click', startAIGeneration);
    }
    
    // Apply AI FAQ button
    const applyAIFaqButton = document.getElementById('applyAIFaqButton');
    if (applyAIFaqButton) {
        applyAIFaqButton.addEventListener('click', applyAIGeneratedFAQ);
    }
    
    // AI Modal close buttons
    document.querySelectorAll('#aiModal .close').forEach(button => {
        button.addEventListener('click', closeAIModal);
    });
    
    // Click outside AI modal to close
    window.addEventListener('click', event => {
        if (event.target === document.getElementById('aiModal')) {
            closeAIModal();
        }
    });
    
    // AI model select change
    const aiModelSelect = document.getElementById('aiModelSelect');
    if (aiModelSelect) {
        aiModelSelect.addEventListener('change', function() {
            selectedAIModel = this.value;
        });
    }

    // AI provider select change
    const aiProviderSelect = document.getElementById('aiProviderSelect');
    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', function() {
            selectedAIProvider = this.value;
            loadAIModels(); // Reload models based on selected provider
        });
    }

    // AI provider radio buttons change event
    document.querySelectorAll('input[name="aiProvider"]').forEach(radio => {
        radio.addEventListener('change', function() {
            selectedAIProvider = this.value;
            loadAIModels(); // Reload models based on selected provider
        });
    });

    // API Key setup - Save buttons
    const saveGroqApiButton = document.getElementById('saveGroqApiButton');
    if (saveGroqApiButton) {
        saveGroqApiButton.addEventListener('click', () => saveApiKey('groq'));
    }

    const saveOpenaiApiButton = document.getElementById('saveOpenaiApiButton');
    if (saveOpenaiApiButton) {
        saveOpenaiApiButton.addEventListener('click', () => saveApiKey('openai'));
    }
    
    // FAQ Adjustment button
    const adjustFaqButton = document.getElementById('adjustFaqButton');
    if (adjustFaqButton) {
        adjustFaqButton.addEventListener('click', adjustGeneratedFAQ);
    }
    
    // Enter key in adjustment prompt
    const faqAdjustmentPrompt = document.getElementById('faqAdjustmentPrompt');
    if (faqAdjustmentPrompt) {
        faqAdjustmentPrompt.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                adjustGeneratedFAQ();
            }
        });
    }
}

/**
 * Save API key for the selected provider
 * @param {string} provider - The AI provider ('groq' or 'openai')
 */
function saveApiKey(provider) {
    const apiKeyInput = document.getElementById(`${provider}ApiKeyInput`);
    if (!apiKeyInput || !apiKeyInput.value.trim()) {
        showToast('Por favor, insira uma API key válida', 'error');
        return;
    }

    const apiKey = apiKeyInput.value.trim();
    
    // Save API key via API
    fetch('/api/faq-ai/save-api-key', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            api_key: apiKey,
            provider: provider
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message, 'success');
            // Fechar o modal após salvar a API key
            closeAIModal();
            // Check if at least one provider is configured
            fetch('/api/faq-ai/check-api-key')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.providers.length > 0) {
                        // Hide API key form and show AI settings
                        document.getElementById('apiKeySetupContainer').classList.add('hidden');
                        document.getElementById('aiConfigContainer').classList.remove('hidden');
                        document.getElementById('aiInitialState').classList.remove('hidden');
                        
                        // Configure available providers
                        setupAvailableProviders(data.providers);
                    }
                });
        } else {
            showToast(data.message || 'Erro ao salvar API key', 'error');
        }
    })
    .catch(error => {
        console.error('Error saving API key:', error);
        showToast('Erro ao salvar a API key', 'error');
    });
}

/**
 * Setup available AI providers based on configured API keys
 * @param {Array} providers - Array of configured providers
 */
function setupAvailableProviders(providers) {
    const groqLabel = document.getElementById('groqProviderLabel');
    const openaiLabel = document.getElementById('openaiProviderLabel');
    const providerWarning = document.getElementById('providerWarning');
    const startGenerationButton = document.getElementById('startGenerationButton');
    
    // Reset states
    groqLabel.classList.remove('opacity-50');
    openaiLabel.classList.remove('opacity-50');
    document.getElementById('groqProvider').disabled = true;
    document.getElementById('openaiProvider').disabled = true;
    
    if (providers.length === 0) {
        // No providers configured
        groqLabel.classList.add('opacity-50');
        openaiLabel.classList.add('opacity-50');
        providerWarning.classList.remove('hidden');
        startGenerationButton.disabled = true;
        return;
    }
    
    // Hide warning and enable generation button
    providerWarning.classList.add('hidden');
    startGenerationButton.disabled = false;
    
    // Enable configured providers
    if (providers.includes('groq')) {
        document.getElementById('groqProvider').disabled = false;
    } else {
        groqLabel.classList.add('opacity-50');
    }
    
    if (providers.includes('openai')) {
        document.getElementById('openaiProvider').disabled = false;
    } else {
        openaiLabel.classList.add('opacity-50');
    }
    
    // Select the first available provider
    if (providers.length > 0) {
        const firstProvider = providers[0];
        const radioInput = document.querySelector(`input[name="aiProvider"][value="${firstProvider}"]`);
        if (radioInput) {
            radioInput.checked = true;
            selectedAIProvider = firstProvider;
            loadAIModels();
        }
    }
}

/**
 * Open the AI generation modal
 * @param {string} lessonId - The ID of the selected lesson
 */
function openAIModal(lessonId) {
    // First check if any AI provider is configured
    fetch('/api/faq-ai/check-api-key')
        .then(response => response.json())
        .then(data => {
            if (!data.success || data.providers.length === 0) {
                // Get the video URL for the selected lesson to confirm it exists
                return fetch(`/api/faq-ai/get-video-url?lesson_id=${lessonId}`)
                    .then(response => response.json())
                    .then(videoData => {
                        if (!videoData.success) {
                            showToast(videoData.message, 'error');
                            return;
                        }
                        
                        // Reset the modal state
                        resetAIModalState();
                        
                        // Store lesson ID for generation later after API key is set
                        document.getElementById('startGenerationButton').dataset.lessonId = lessonId;
                        
                        // Hide AI settings, show API key setup form
                        document.getElementById('aiConfigContainer').classList.add('hidden');
                        document.getElementById('apiKeySetupContainer').classList.remove('hidden');
                        document.getElementById('aiInitialState').classList.add('hidden');
                        
                        // Show the modal
                        document.getElementById('aiModal').style.display = 'block';
                        
                        // Re-initialize Lucide icons
                        lucide.createIcons();
                    });
            } else {
                // At least one provider is configured, proceed normally
                return fetch(`/api/faq-ai/get-video-url?lesson_id=${lessonId}`)
                    .then(response => response.json())
                    .then(videoData => {
                        if (!videoData.success) {
                            showToast(videoData.message, 'error');
                            return;
                        }
                        
                        // Reset the modal state
                        resetAIModalState();
                        
                        // Update lesson info in the modal
                        const lessonTitle = document.querySelector(`#formLessonSelect option[value="${lessonId}"]`).textContent;
                        document.getElementById('aiLessonInfo').innerHTML = `
                            <div class="flex items-center">
                                <div class="bg-purple-100 rounded-full p-2 mr-3">
                                    <i data-lucide="play" class="h-5 w-5 text-purple-600"></i>
                                </div>
                                <div>
                                    <h4 class="text-sm font-medium text-gray-900">${lessonTitle}</h4>
                                    <p class="text-xs text-gray-500">Tipo de vídeo: ${videoData.video_type === 'youtube' ? 'YouTube' : videoData.video_type}</p>
                                </div>
                            </div>
                        `;
                        
                        // Show AI settings, hide API key setup form
                        document.getElementById('aiConfigContainer').classList.remove('hidden');
                        document.getElementById('apiKeySetupContainer').classList.add('hidden');
                        document.getElementById('aiInitialState').classList.remove('hidden');
                        
                        // Setup available providers
                        setupAvailableProviders(data.providers);
                        
                        // Store lesson ID for generation
                        document.getElementById('startGenerationButton').dataset.lessonId = lessonId;
                        
                        // Show the modal
                        document.getElementById('aiModal').style.display = 'block';
                        
                        // Re-initialize Lucide icons
                        lucide.createIcons();
                    });
            }
        })
        .catch(error => {
            console.error('Error opening AI modal:', error);
            showToast('Erro ao preparar a geração de FAQ', 'error');
        });
}

/**
 * Load available AI models for generation
 */
function loadAIModels() {
    fetch(`/api/faq-ai/models?provider=${selectedAIProvider}`)
        .then(response => response.json())
        .then(data => {
            const modelSelect = document.getElementById('aiModelSelect');
            modelSelect.innerHTML = '';
            
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                option.title = model.description;
                modelSelect.appendChild(option);
            });
            
            // Select default model based on provider
            if (data.models.length > 0) {
                modelSelect.value = data.models[0].id;
                selectedAIModel = data.models[0].id;
            }
        })
        .catch(error => {
            console.error('Error loading AI models:', error);
        });
}

/**
 * Reset AI modal to initial state
 */
function resetAIModalState() {
    // Show initial state, hide others
    document.getElementById('aiInitialState').classList.remove('hidden');
    document.getElementById('aiGeneratingState').classList.add('hidden');
    document.getElementById('aiResultsContainer').classList.add('hidden');
    document.getElementById('aiErrorState').classList.add('hidden');
    
    // Reset generated FAQs
    aiGeneratedFAQs = [];
    document.getElementById('aiGeneratedFAQs').innerHTML = '';
    
    // Reset API key input
    const apiKeyInput = document.getElementById('groqApiKeyInput');
    if (apiKeyInput) {
        apiKeyInput.value = '';
    }
}

/**
 * Close the AI generation modal
 */
function closeAIModal() {
    document.getElementById('aiModal').style.display = 'none';
}

/**
 * Start the AI generation process
 */
function startAIGeneration() {
    // Get lesson ID from button data attribute
    const lessonId = document.getElementById('startGenerationButton').dataset.lessonId;
    const modelId = document.getElementById('aiModelSelect').value;
    const provider = document.querySelector('input[name="aiProvider"]:checked').value;
    
    if (!lessonId) {
        showToast('ID da aula não encontrado', 'error');
        return;
    }
    
    // Show generating state
    document.getElementById('aiInitialState').classList.add('hidden');
    document.getElementById('aiGeneratingState').classList.remove('hidden');
    document.getElementById('generationStatusMessage').textContent = 'Processando vídeo...';
    document.getElementById('generationStatusDetail').textContent = 'Isso pode levar alguns minutos dependendo da duração do vídeo.';
    
    // Make API request to generate FAQ
    fetch('/api/faq-ai/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lesson_id: lessonId,
            model_id: modelId,
            provider: provider
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.message);
        }
        
        // Store generated FAQs
        aiGeneratedFAQs = data.faqs;
        
        // Display the results
        displayAIGeneratedFAQs(data.faqs);
        
        // Show results container
        document.getElementById('aiGeneratingState').classList.add('hidden');
        document.getElementById('aiResultsContainer').classList.remove('hidden');
    })
    .catch(error => {
        console.error('Error generating FAQ:', error);
        
        // Show error state
        document.getElementById('aiGeneratingState').classList.add('hidden');
        document.getElementById('aiErrorState').classList.remove('hidden');
        document.getElementById('aiErrorMessage').textContent = error.message || 'Erro ao gerar FAQ. Por favor, tente novamente.';
    });
}

/**
 * Display the AI-generated FAQs in the modal
 * @param {Array} faqs - Array of FAQ objects
 */
function displayAIGeneratedFAQs(faqs) {
    const container = document.getElementById('aiGeneratedFAQs');
    container.innerHTML = '';
    
    faqs.forEach((faq, index) => {
        const faqItem = document.createElement('div');
        faqItem.className = 'faq-item';
        
        faqItem.innerHTML = `
            <div class="faq-item-header" onclick="toggleFAQItem(this)">
                <h3 class="text-md font-semibold text-gray-800">${index + 1}. ${escapeHtml(faq.question)}</h3>
                <i data-lucide="chevron-down" class="h-5 w-5 text-gray-500"></i>
            </div>
            <div class="faq-item-content hidden">
                <p class="text-gray-600 whitespace-pre-wrap">${escapeHtml(faq.answer)}</p>
            </div>
        `;
        
        container.appendChild(faqItem);
    });
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

/**
 * Apply the AI-generated FAQs to the FAQ form
 */
function applyAIGeneratedFAQ() {
    if (!aiGeneratedFAQs || aiGeneratedFAQs.length === 0) {
        showToast('Nenhum FAQ gerado para aplicar', 'error');
        return;
    }
    
    // Clear existing FAQ pairs
    const container = document.getElementById('faqPairsContainer');
    container.innerHTML = '';
    
    // Add each FAQ pair
    aiGeneratedFAQs.forEach((faq, index) => {
        // Check if we're at the limit
        if (index >= 10) {
            return; // Skip if we already have 10 FAQs
        }
        
        addFAQPairToContainer(
            index, 
            faq.question, 
            faq.answer, 
            index >= 3 || aiGeneratedFAQs.length > 3
        );
    });
    
    // Update counter
    updateFAQCounter();
    
    // Re-initialize Lucide icons
    lucide.createIcons();
    
    // Close the AI modal
    closeAIModal();
    
    // Show success message
    showToast('FAQ gerado pela IA aplicado com sucesso!', 'success');
}

/**
 * Adjust the generated FAQ based on user prompt
 */
function adjustGeneratedFAQ() {
    const promptInput = document.getElementById('faqAdjustmentPrompt');
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
        showToast('Digite uma instrução para ajustar o FAQ', 'error');
        return;
    }
    
    if (!aiGeneratedFAQs || aiGeneratedFAQs.length === 0) {
        showToast('Nenhum FAQ gerado para ajustar', 'error');
        return;
    }
    
    // Show loading state
    document.getElementById('adjustFaqButton').disabled = true;
    document.getElementById('adjustFaqButton').innerHTML = `
        <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-purple-700 mr-2"></div>
        Ajustando...
    `;
    
    // Get current model and provider
    const modelId = document.getElementById('aiModelSelect').value;
    const provider = document.querySelector('input[name="aiProvider"]:checked').value;
    
    // Make API request to adjust FAQ
    fetch('/api/faq-ai/adjust', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: prompt,
            faqs: aiGeneratedFAQs,
            model_id: modelId,
            provider: provider
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.message);
        }
        
        // Update the generated FAQs
        aiGeneratedFAQs = data.faqs;
        
        // Display the adjusted FAQs
        displayAIGeneratedFAQs(data.faqs);
        
        // Clear the prompt input
        promptInput.value = '';
        
        // Show success message
        showToast('FAQ ajustado com sucesso!', 'success');
    })
    .catch(error => {
        console.error('Error adjusting FAQ:', error);
        showToast(error.message || 'Erro ao ajustar FAQ', 'error');
    })
    .finally(() => {
        // Reset button state
        document.getElementById('adjustFaqButton').disabled = false;
        document.getElementById('adjustFaqButton').innerHTML = `
            <i data-lucide="wand-2" class="w-4 h-4 mr-2"></i>
            Ajustar
        `;
        // Re-initialize Lucide icons
        lucide.createIcons();
    });
}