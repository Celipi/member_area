document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { PlyrLayout, VidstackPlayer } = await import('https://cdn.vidstack.io/player');
        const player = await VidstackPlayer.create({
            target: '#target',
            title: window.video_title,
            src: window.video_url,
            playsinline: true, // Desabilitar FullScreen
            layout: new PlyrLayout({})
        });
        window.player = player;
        
        // Show CTA button when video reaches the specified time
        if (window.button_delay) {
            const ctaButton = document.getElementById('ctaButton');
            let ctaDisplayed = false;
            let unsubscribe;

            function checkTime({ currentTime }) {
                if (!ctaDisplayed && currentTime >= window.button_delay) {
                    ctaButton.style.display = 'block';
                    ctaDisplayed = true;
                    if (unsubscribe) {
                        unsubscribe();
                    }
                }
            }

            unsubscribe = player.subscribe(checkTime);
        }
    } catch (error) {
        console.error('Erro ao inicializar o player:', error);
    }

    // Load FAQs for the current lesson
    loadFAQ();
});

document.addEventListener('DOMContentLoaded', () => {
    const markAsCompletedBtn = document.getElementById('markAsCompletedBtn');
    if (markAsCompletedBtn) {
        markAsCompletedBtn.addEventListener('click', function() {
            if (this.disabled) return;
            fetch('/mark_lesson_completed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lesson_id: window.lesson_id })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.innerHTML = '<i data-lucide="check-circle" class="mr-2 h-5 w-5"></i> Aula concluída';
                    this.disabled = true;
                    lucide.createIcons();
                } else {
                    alert('Erro ao marcar aula como concluída.');
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                alert('Erro ao marcar aula como concluída.');
            });
        });
    }
    loadSupportEmail();
    loadPlatformName();
});

// Nova função para carregar o email de suporte
function loadSupportEmail() {
    fetch('/api/support-email')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.support_email) {
                document.getElementById('supportEmail').textContent = data.support_email;
                document.getElementById('supportEmailLink').href = `mailto:${data.support_email}`;
                document.getElementById('supportEmailLink').style.display = 'flex';
            } else {
                document.getElementById('supportEmailLink').style.display = 'none';
            }
        })
        .catch(error => console.error('Erro ao carregar email de suporte:', error));
}

// Nova função para carregar o platform_name e atualizar o footer
function loadPlatformName() {
    fetch('/dashboard', {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.platform_name) {
            document.getElementById('footerPlatformName').textContent = data.platform_name;
        }
    })
    .catch(error => console.error('Erro ao carregar platform name:', error));
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// FAQ functionality
function loadFAQ() {
    const faqContainer = document.getElementById('faqContainer');
    const faqEmptyState = document.getElementById('faqEmptyState');
    const fullFaqSection = document.getElementById('full_faq'); // Get the full FAQ section
    
    fetch(`/api/faq/lesson/${window.lesson_id}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                fullFaqSection.style.display = 'block'; // Show FAQ section
                faqEmptyState.style.display = 'none';
                
                // Check if device is mobile (screen width less than 768px)
                const isMobile = window.innerWidth < 768;
                
                faqContainer.innerHTML = data.map((item, index) => {
                    if (isMobile) {
                        // Mobile layout - without number circle
                        return `
                            <div class="faq-item" data-faq-id="${item.id}">
                                <button class="w-full text-left flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <h4 class="text-gray-800 font-medium pr-8 flex-1">${escapeHtml(item.question)}</h4>
                                    <i data-lucide="chevron-down" class="h-5 w-5 text-gray-400 transform transition-transform flex-shrink-0"></i>
                                </button>
                                <div class="faq-answer hidden px-4 py-3 border-t border-gray-200">
                                    <p class="text-gray-600 whitespace-pre-wrap">${escapeHtml(item.answer)}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        // Desktop layout - with number circle
                        return `
                            <div class="faq-item" data-faq-id="${item.id}">
                                <button class="w-full text-left flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div class="flex items-center flex-1">
                                        <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                                            <span class="text-primary text-sm font-medium">${index + 1}</span>
                                        </div>
                                        <h4 class="text-gray-800 font-medium pr-8">${escapeHtml(item.question)}</h4>
                                    </div>
                                    <i data-lucide="chevron-down" class="h-5 w-5 text-gray-400 transform transition-transform"></i>
                                </button>
                                <div class="faq-answer hidden px-4 py-3 border-t border-gray-200">
                                    <p class="text-gray-600 whitespace-pre-wrap pl-11">${escapeHtml(item.answer)}</p>
                                </div>
                            </div>
                        `;
                    }
                }).join('');

                // Initialize Lucide icons
                lucide.createIcons();

                // Add click handlers for FAQ items
                document.querySelectorAll('.faq-item button').forEach(button => {
                    button.addEventListener('click', () => {
                        const answer = button.nextElementSibling;
                        const icon = button.querySelector('[data-lucide="chevron-down"]');
                        
                        // Close all other FAQs
                        document.querySelectorAll('.faq-answer').forEach(otherAnswer => {
                            if (otherAnswer !== answer && !otherAnswer.classList.contains('hidden')) {
                                otherAnswer.classList.add('hidden');
                                otherAnswer.previousElementSibling.querySelector('[data-lucide="chevron-down"]').style.transform = '';
                            }
                        });
                        
                        answer.classList.toggle('hidden');
                        icon.style.transform = answer.classList.contains('hidden') ? '' : 'rotate(180deg)';
                    });
                });
            } else {
                fullFaqSection.style.display = 'none'; // Hide entire FAQ section when no data
            }
        })
        .catch(error => {
            console.error('Error loading FAQ:', error);
            fullFaqSection.style.display = 'none'; // Hide FAQ section on error
        });
}

// Configuração do botão CTA
function setupCTAButton() {
    const ctaButton = document.getElementById('ctaButton');
    if (ctaButton && window.button_delay) {
        setTimeout(() => {
            ctaButton.style.display = 'block';
            // Adiciona classe de animação se desejar
            ctaButton.classList.add('fade-in');
        }, window.button_delay * 1000);
    }
}

function setupVideo() {
    // Não precisa fazer nada para o VTurb pois o código já inclui o script necessário
    // O código inserido via innerHTML já contém tudo que é necessário
}