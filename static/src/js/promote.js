/**
 * Promotion Manager JavaScript
 * Handles all interactions for the promotion management interface
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modal functionality
    initializeModals();
    
    // Initialize form validation and interactions
    initializeFormInteractions();
    
    // Set today's date as the minimum for date inputs
    setMinimumDates();
    
    // Load promotions data
    loadPromotions();

    // Initialize search and filter functionality
    initializeSearchAndFilter();
});

/**
 * Initialize modal functionality
 */
function initializeModals() {
    // Get all modal elements
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');
    
    // Set up event listener for the "Add New Promotion" button
    const addPromotionBtn = document.querySelector('button[onclick="addNewPromotion()"]');
    if (addPromotionBtn) {
        addPromotionBtn.onclick = function() {
            openModal('newPromotionModal');
        };
    }
    
    // Set up close buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal.id);
        });
    });
    
    // Close modal when clicking outside
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeModal(this.id);
            }
        });
    });
}

/**
 * Open a modal by its ID
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    }
}

/**
 * Close a modal by its ID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scrolling
        
        // If it's the promotion form modal, reset everything
        if (modalId === 'newPromotionModal') {
            const form = document.getElementById('newPromotionForm');
            form.reset();
            
            // Reset title to "Nova Promoção"
            modal.querySelector('h2').textContent = 'Nova Promoção';
            
            // Reset submit button text
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Salvar Promoção';
            
            // Remove any hidden fields
            form.querySelector('input[name="promotion_id"]')?.remove();
            form.querySelector('input[name="is_active"]')?.remove();
            
            // Reset media preview
            document.getElementById('previewImage').classList.add('hidden');
            document.getElementById('uploadPlaceholder').classList.remove('hidden');
            
            // Reset media sections
            document.getElementById('imageUploadSection').style.display = 'block';
            document.getElementById('videoUrlSection').style.display = 'none';
            
            // Reset video URL if exists
            const videoUrl = document.getElementById('videoUrl');
            if (videoUrl) videoUrl.value = '';
            
            // Reset CTA section
            document.getElementById('ctaSection').classList.add('hidden');
            document.getElementById('ctaToggle').checked = false;
            
            // Set today's date for start and end date
            setMinimumDates();
            
            // Reinitialize icons
            lucide.createIcons();
        }
    }
}

/**
 * Initialize form interactions
 */
function initializeFormInteractions() {
    // Media type selection
    const mediaTypeRadios = document.querySelectorAll('input[name="mediaType"]');
    mediaTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            toggleMediaSection(this.value);
        });
    });
    
    // Image preview functionality
    const imageInput = document.getElementById('promotionImage');
    if (imageInput) {
        imageInput.addEventListener('change', function() {
            previewImage(this);
        });
    }
    
    // CTA toggle functionality
    const ctaToggle = document.getElementById('ctaToggle');
    if (ctaToggle) {
        ctaToggle.addEventListener('change', function() {
            toggleCTASection(this.checked);
        });
    }
    
    // Form submission
    const promotionForm = document.getElementById('newPromotionForm');
    if (promotionForm) {
        promotionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate dates
            if (!validateDates()) {
                return false;
            }
            
            createPromotion(new FormData(this));
        });
    }
    
    // Video preview button
    const previewVideoBtn = document.getElementById('previewVideoBtn');
    if (previewVideoBtn) {
        previewVideoBtn.addEventListener('click', function() {
            const videoUrl = document.getElementById('videoUrl').value;
            if (videoUrl.trim() === '') {
                alert('Por favor, insira uma URL de vídeo válida.');
                return;
            }
            
            // Here you would typically show a video preview
            // For simplicity, we'll just open the URL in a new tab
            window.open(videoUrl, '_blank');
        });
    }
}

/**
 * Toggle between image and video sections based on media type
 */
function toggleMediaSection(mediaType) {
    const imageSection = document.getElementById('imageUploadSection');
    const videoSection = document.getElementById('videoUrlSection');
    const delayField = document.querySelector('#ctaSection .relative:has(#buttonDelay)');
    
    if (mediaType === 'image') {
        imageSection.style.display = 'block';
        videoSection.style.display = 'none';
        
        // Ocultar completamente o campo de delay e definir valor como 0 quando for image
        if (delayField) {
            delayField.style.display = 'none';
            document.getElementById('buttonDelay').value = '0';
        }
    } else if (mediaType === 'video') {
        imageSection.style.display = 'none';
        videoSection.style.display = 'block';
        
        // Mostrar campo de delay quando for vídeo
        if (delayField) {
            delayField.style.display = 'block';
        }
    }
}

/**
 * Show/hide CTA section based on toggle state
 */
function toggleCTASection(isChecked) {
    const ctaSection = document.getElementById('ctaSection');
    
    if (isChecked) {
        ctaSection.classList.remove('hidden');
        
        // Verificar o tipo de mídia atual para decidir se mostra o campo de delay
        const selectedMediaType = document.querySelector('input[name="mediaType"]:checked').value;
        const delayField = document.querySelector('#ctaSection .relative:has(#buttonDelay)');
        
        if (delayField) {
            if (selectedMediaType === 'image') {
                delayField.style.display = 'none';
                document.getElementById('buttonDelay').value = '0';
            } else {
                delayField.style.display = 'block';
            }
        }
    } else {
        ctaSection.classList.add('hidden');
    }
}

/**
 * Create image preview when file is selected
 */
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        const previewImg = document.getElementById('previewImage');
        const placeholder = document.getElementById('uploadPlaceholder');
        
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * Validate date ranges
 */
function validateDates() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Por favor, preencha as datas inicial e final.');
        return false;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) {
        alert('A data final deve ser posterior à data inicial.');
        return false;
    }
    
    return true;
}

/**
 * Set minimum date values to today
 */
function setMinimumDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    let mm = today.getMonth() + 1; // Months are zero-indexed
    let dd = today.getDate();
    
    // Ensure two-digit format
    if (mm < 10) mm = '0' + mm;
    if (dd < 10) dd = '0' + dd;
    
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    // Set minimum dates for date inputs
    document.getElementById('startDate').min = todayStr;
    document.getElementById('endDate').min = todayStr;
    
    // Set default values to today
    document.getElementById('startDate').value = todayStr;
}

/**
 * Initialize search and filter functionality
 */
function initializeSearchAndFilter() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    
    searchInput.addEventListener('input', debounce(() => {
        loadPromotions();
    }, 300));
    
    statusFilter.addEventListener('change', () => {
        loadPromotions();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Load promotions data
 */
async function loadPromotions(page = 1) {
    const searchQuery = document.getElementById('searchInput').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    try {
        const response = await fetch(`/api/promotions?page=${page}&search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`);
        const data = await response.json();
        
        updatePromotionsTable(data.promotions);
        updatePagination(data.current_page, data.total_pages);
        updateStatistics(data.total, data.active);
        
    } catch (error) {
        console.error('Error loading promotions:', error);
        alert('Erro ao carregar promoções. Por favor, tente novamente.');
    }
}

/**
 * Update promotions table
 */
function updatePromotionsTable(promotions) {
    const tbody = document.getElementById('promotionTableBody');
    const tableContainer = tbody.closest('.overflow-x-auto');
    const emptyState = document.getElementById('emptyState');
    
    if (!promotions || promotions.length === 0) {
        tableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    tableContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tbody.innerHTML = '';
    
    promotions.forEach(promotion => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50';
        
        row.innerHTML = `
            <td class="py-4 px-4">
                <div class="flex items-center">
                    <div class="w-10 h-10 mr-3 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                        ${promotion.media_type === 'image' 
                            ? `<img src="/static/uploads/${promotion.media_url}" class="w-full h-full object-cover" alt="${promotion.title}">`
                            : `<div class="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                                   <i data-lucide="video" class="h-5 w-5"></i>
                               </div>`
                        }
                    </div>
                    <div>
                        <p class="font-medium text-gray-800 text-sm">${promotion.title}</p>
                        <p class="text-sm text-gray-500 truncate max-w-xs">${promotion.description}</p>
                    </div>
                </div>
            </td>
            <td class="py-4 px-4 text-sm">
                <div class="text-gray-800">${formatDate(promotion.start_date)} - ${formatDate(promotion.end_date)}</div>
            </td>
            <td class="py-4 px-4">
                ${getStatusBadge(promotion.status)}
            </td>
            <td class="py-4 px-4 text-sm text-gray-800">
                <div class="flex items-center">
                    ${promotion.button_delay > 0 ? 
                        `${promotion.button_delay} segundos` : 
                        `<span>0 segundos</span>
                        <span class="ml-1 text-xs text-gray-500">(imediato)</span>`
                    }
                </div>
            </td>
            <td class="py-4 px-4 text-center">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="toggle-${promotion.id}" ${promotion.is_active ? 'checked' : ''} 
                           onchange="togglePromotion(${promotion.id})" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </td>
            <td class="py-4 px-4 text-right space-x-2">
                <button onclick="editPromotion(${promotion.id})" class="text-gray-500 hover:text-primary transition-colors" title="Editar">
                    <i data-lucide="edit" class="h-5 w-5"></i>
                </button>
                <button onclick="deletePromotion(${promotion.id})" class="text-gray-500 hover:text-primary transition-colors" title="Excluir">
                    <i data-lucide="trash-2" class="h-5 w-5"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

/**
 * Update pagination
 */
function updatePagination(currentPage, totalPages) {
    const pagination = document.getElementById('pagination');
    const paginationInfo = document.getElementById('paginationInfo');
    
    pagination.innerHTML = '';
    
    // Previous button
    pagination.appendChild(createPaginationButton('previous', currentPage > 1, currentPage - 1));
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        pagination.appendChild(createPaginationButton('number', true, i, i === currentPage));
    }
    
    // Next button
    pagination.appendChild(createPaginationButton('next', currentPage < totalPages, currentPage + 1));
}

/**
 * Create pagination button
 */
function createPaginationButton(type, enabled, page, isActive = false) {
    const button = document.createElement('button');
    button.className = `pagination-btn ${isActive ? 'active' : ''} ${!enabled ? 'disabled' : ''}`;
    if (!enabled) button.disabled = true;
    
    if (type === 'previous') {
        button.innerHTML = '<i data-lucide="chevron-left" class="h-4 w-4"></i>';
    } else if (type === 'next') {
        button.innerHTML = '<i data-lucide="chevron-right" class="h-4 w-4"></i>';
    } else {
        button.textContent = page;
    }
    
    if (enabled) {
        button.onclick = () => loadPromotions(page);
    }
    
    return button;
}

/**
 * Update statistics counters
 */
function updateStatistics(total, active) {
    document.getElementById('totalPromotions').textContent = total;
    document.getElementById('activePromotions').textContent = active;
}

/**
 * Format date
 */
function formatDate(dateStr) {
    // Parse the date in UTC to avoid timezone issues
    const parts = dateStr.split('T')[0].split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(parts[2]);
    
    // Create date using UTC to avoid timezone conversions
    const date = new Date(Date.UTC(year, month, day));
    
    // Format the date in Brazilian Portuguese format (DD/MM/YYYY)
    return date.getUTCDate().toString().padStart(2, '0') + '/' + 
           (date.getUTCMonth() + 1).toString().padStart(2, '0') + '/' + 
           date.getUTCFullYear();
}

/**
 * Get status badge
 */
function getStatusBadge(status) {
    const statusConfig = {
        'active': { bg: 'bg-green-100', text: 'text-green-800', label: 'Ativo' },
        'inactive': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inativo' },
        'upcoming': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Programados' },
        'expired': { bg: 'bg-red-100', text: 'text-red-800', label: 'Expirado' }
    };
    
    const config = statusConfig[status] || statusConfig['inactive'];
    return `<span class="px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}">${config.label}</span>`;
}

/**
 * Create promotion
 */
async function createPromotion(formData) {
    try {
        // Fix media type field name to match what server expects
        if (formData.has('mediaType')) {
            const mediaType = formData.get('mediaType');
            formData.set('mediaType', mediaType);
            
            // Make sure media_url is set for video type
            if (mediaType === 'video' && !formData.has('media_url')) {
                const videoUrl = document.getElementById('videoUrl').value;
                formData.set('media_url', videoUrl);
            }
        }
        
        // Make sure has_cta value is properly set as a string
        if (formData.has('has_cta')) {
            // If checkbox is checked, it will be included in the FormData
            formData.set('has_cta', 'true');
        } else {
            // Explicitly add it as false if not present
            formData.append('has_cta', 'false');
        }
        
        // Always set is_active to false for new promotions
        formData.set('is_active', 'false');
        
        // Make sure button_delay is set even if the CTA section is hidden
        if (!formData.has('button_delay')) {
            formData.append('button_delay', '0');
        }
        
        // Make sure hide_video_controls value is properly set
        const hideVideoControls = document.getElementById('hideVideoControls');
        if (hideVideoControls) {
            formData.set('hide_video_controls', hideVideoControls.checked ? 'true' : 'false');
        }
        
        // Debug what's being sent
        console.log("Form data being sent:");
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }
        
        const response = await fetch('/api/promotions', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal('newPromotionModal');
            loadPromotions();
            alert('Promoção criada com sucesso!');
        } else {
            alert(result.message || result.error || 'Erro ao criar promoção');
        }
    } catch (error) {
        console.error('Error creating promotion:', error);
        alert('Erro ao criar promoção. Por favor, tente novamente.');
    }
}

/**
 * Edit promotion
 */
async function editPromotion(id) {
    try {
        const response = await fetch(`/api/promotions/${id}`);
        const promotion = await response.json();
        
        // Open modal first
        openModal('newPromotionModal');
        
        // Update modal title
        document.querySelector('#newPromotionModal h2').textContent = 'Editar Promoção';
        
        // Preencher o formulário com os dados da promoção
        populateEditForm(promotion);
    } catch (error) {
        console.error('Error loading promotion:', error);
        alert('Erro ao carregar dados da promoção');
    }
}

/**
 * Delete promotion
 */
async function deletePromotion(id) {
    if (!confirm('Tem certeza que deseja excluir esta promoção?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/promotions/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadPromotions();
            alert('Promoção excluída com sucesso!');
        } else {
            alert(result.message || 'Erro ao excluir promoção');
        }
    } catch (error) {
        console.error('Error deleting promotion:', error);
        alert('Erro ao excluir promoção. Por favor, tente novamente.');
    }
}

/**
 * Toggle promotion status
 */
async function togglePromotion(id) {
    try {
        const checkbox = document.getElementById(`toggle-${id}`);
        const isActive = checkbox.checked;
        
        const response = await fetch(`/api/promotions/${id}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Reload the page to update all information
            window.location.reload();
        } else {
            // Revert the checkbox state if the operation failed
            checkbox.checked = !isActive;
            alert(result.message || 'Erro ao alterar status da promoção');
        }
    } catch (error) {
        console.error('Error toggling promotion:', error);
        // Revert the checkbox state if there was an error
        const checkbox = document.getElementById(`toggle-${id}`);
        checkbox.checked = !checkbox.checked;
        alert('Erro ao alterar status da promoção. Por favor, tente novamente.');
    }
}

/**
 * Populate edit form
 */
function populateEditForm(promotion) {
    const form = document.getElementById('newPromotionForm');
    
    // Campos básicos
    form.querySelector('#promotionTitle').value = promotion.title;
    form.querySelector('#promotionText').value = promotion.description;
    form.querySelector('#startDate').value = promotion.start_date.split('T')[0];
    form.querySelector('#endDate').value = promotion.end_date.split('T')[0];
    
    // Media type
    const mediaType = promotion.media_type;
    form.querySelector(`input[name="mediaType"][value="${mediaType}"]`).checked = true;
    toggleMediaSection(mediaType);
    
    if (mediaType === 'video') {
        form.querySelector('#videoUrl').value = promotion.media_url;
    }
    
    // CTA
    form.querySelector('#ctaToggle').checked = promotion.has_cta;
    toggleCTASection(promotion.has_cta);
    if (promotion.has_cta) {
        form.querySelector('#buttonText').value = promotion.cta_text;
        form.querySelector('#buttonUrl').value = promotion.cta_url;
        form.querySelector('#buttonDelay').value = promotion.button_delay || 0;
        
        // Garantir que o campo de delay esteja oculto se for imagem
        if (mediaType === 'image') {
            const delayField = document.querySelector('#ctaSection .relative:has(#buttonDelay)');
            if (delayField) {
                delayField.style.display = 'none';
            }
        }
    }
    
    // Adicionar ID da promoção em um campo oculto para saber que é uma edição
    let hiddenId = form.querySelector('input[name="promotion_id"]');
    if (!hiddenId) {
        hiddenId = document.createElement('input');
        hiddenId.type = 'hidden';
        hiddenId.name = 'promotion_id';
        form.appendChild(hiddenId);
    }
    hiddenId.value = promotion.id;
    
    // Adicionar hidden input para is_active
    let isActiveInput = form.querySelector('input[name="is_active"]');
    if (!isActiveInput) {
        isActiveInput = document.createElement('input');
        isActiveInput.type = 'hidden';
        isActiveInput.name = 'is_active';
        form.appendChild(isActiveInput);
    }
    isActiveInput.value = promotion.is_active ? 'true' : 'false';
    
    // Atualizar texto do botão de submit
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Atualizar Promoção';
    lucide.createIcons();
    
    // Mostrar preview da imagem se for uma promoção com imagem
    if (mediaType === 'image') {
        const previewImg = document.getElementById('previewImage');
        const placeholder = document.getElementById('uploadPlaceholder');
        previewImg.src = `/static/uploads/${promotion.media_url}`;
        previewImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }
    
    // Set video controls toggle
    if (promotion.media_type === 'video') {
        form.querySelector('#hideVideoControls').checked = promotion.hide_video_controls;
    }
}

/**
 * Function to open the new promotion modal
 * This is called by the "Nova Promoção" button
 */
function addNewPromotion() {
    // Reset form if it exists
    const form = document.getElementById('newPromotionForm');
    if (form) {
        form.reset();
        
        // Reset any hidden fields
        let hiddenId = form.querySelector('input[name="promotion_id"]');
        if (hiddenId) {
            hiddenId.remove();
        }
        
        // Make sure the preview image is hidden
        document.getElementById('previewImage').classList.add('hidden');
        document.getElementById('uploadPlaceholder').classList.remove('hidden');
        
        // Hide CTA section
        document.getElementById('ctaSection').classList.add('hidden');
        
        // Show image section, hide video section
        document.getElementById('imageUploadSection').style.display = 'block';
        document.getElementById('videoUrlSection').style.display = 'none';
        
        // Reset button text if it was changed
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4 mr-2"></i> Salvar Promoção';
            lucide.createIcons();
        }
        
        // Set today's date for start and end date
        setMinimumDates();
    }
    
    openModal('newPromotionModal');
}