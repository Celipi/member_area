/**
 * FAQ Manager JavaScript
 */

// Global variables
let currentPage = 1;
const perPage = 10;
let totalPages = 0;
let selectedLessonId = null;

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Load initial data
    loadFAQs();
    loadCourses();
    loadFAQStats();
    
    // Set up event listeners
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    // Close modal buttons
    document.querySelectorAll('.close').forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('faqModal').style.display = 'none';
            document.getElementById('faqDetailsModal').style.display = 'none';
        });
    });
    
    // Click outside modal to close
    window.addEventListener('click', event => {
        if (event.target === document.getElementById('faqModal')) {
            document.getElementById('faqModal').style.display = 'none';
        }
        if (event.target === document.getElementById('faqDetailsModal')) {
            document.getElementById('faqDetailsModal').style.display = 'none';
        }
    });
    
    // Form course select change
    document.getElementById('formCourseSelect').addEventListener('change', function() {
        const courseId = this.value;
        if (courseId) {
            loadModules(courseId, 'formModuleSelect');
            document.getElementById('formModuleSelect').disabled = false;
            document.getElementById('formLessonSelect').disabled = true;
            document.getElementById('formLessonSelect').innerHTML = '<option value="">Selecione uma aula</option>';
        } else {
            document.getElementById('formModuleSelect').disabled = true;
            document.getElementById('formLessonSelect').disabled = true;
            document.getElementById('formModuleSelect').innerHTML = '<option value="">Selecione um módulo</option>';
            document.getElementById('formLessonSelect').innerHTML = '<option value="">Selecione uma aula</option>';
        }
    });
    
    // Form module select change
    document.getElementById('formModuleSelect').addEventListener('change', function() {
        const moduleId = this.value;
        if (moduleId) {
            loadLessons(moduleId);
            document.getElementById('formLessonSelect').disabled = false;
        } else {
            document.getElementById('formLessonSelect').disabled = true;
            document.getElementById('formLessonSelect').innerHTML = '<option value="">Selecione uma aula</option>';
        }
    });
    
    // Form lesson select change
    document.getElementById('formLessonSelect').addEventListener('change', function() {
        selectedLessonId = this.value;
        
        if (selectedLessonId) {
            // Check if the lesson already has FAQs
            checkLessonHasFAQ(selectedLessonId);
        }
    });
    
    // Add FAQ button
    document.getElementById('addFaqButton').addEventListener('click', function() {
        addNewFAQPair();
    });
    
    // FAQ form submission
    document.getElementById('faqForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitFAQForm();
    });
    
    // Filter change events
    document.getElementById('courseFilter').addEventListener('change', function() {
        const courseId = this.value;
        if (courseId) {
            loadModules(courseId, 'moduleFilter');
            document.getElementById('moduleFilter').disabled = false;
        } else {
            document.getElementById('moduleFilter').disabled = true;
            document.getElementById('moduleFilter').innerHTML = '<option value="">Todos os módulos</option>';
        }
        currentPage = 1;
        loadFAQs();
    });
    
    document.getElementById('moduleFilter').addEventListener('change', function() {
        currentPage = 1;
        loadFAQs();
    });
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', debounce(function() {
        currentPage = 1;
        loadFAQs();
    }, 300));
}

// Check if a lesson already has FAQs
function checkLessonHasFAQ(lessonId) {
    fetch(`/api/faq/lesson/${lessonId}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                // Lesson already has FAQs - populate form with them
                populateFormWithExistingFAQs(data);
                document.getElementById('modalTitle').textContent = 'Editar FAQ';
            } else {
                // No FAQs yet - clear the form to create new ones
                resetFaqForm();
                document.getElementById('modalTitle').textContent = 'Novo FAQ';
            }
        })
        .catch(error => console.error('Error checking lesson FAQs:', error));
}

// Load FAQs with filters and pagination
function loadFAQs() {
    const searchQuery = document.getElementById('searchInput').value;
    const courseId = document.getElementById('courseFilter').value;
    const moduleId = document.getElementById('moduleFilter').value;
    
    const url = `/api/faqs?page=${currentPage}&search=${encodeURIComponent(searchQuery)}&course=${courseId}&module=${moduleId}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayFAQs(data.faqs);
            updatePagination(data.total, data.pages, data.current_page);
            
            // Show/hide empty state
            const emptyState = document.getElementById('emptyState');
            if (data.faqs.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        })
        .catch(error => console.error('Error loading FAQs:', error));
}

// Display FAQs in the table
function displayFAQs(faqs) {
    const tableBody = document.getElementById('faqTableBody');
    tableBody.innerHTML = '';
    
    faqs.forEach(faq => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${escapeHtml(faq.lesson_title)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${escapeHtml(faq.module_name)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${escapeHtml(faq.course_name)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="text-sm text-gray-900">${faq.faq_count}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-primary hover:text-red-800 mr-3" onclick="viewFAQDetails(${faq.lesson_id})">
                    <i data-lucide="eye" class="h-4 w-4"></i>
                </button>
                <button class="text-blue-600 hover:text-blue-800 mr-3" onclick="editFAQ(${faq.lesson_id})">
                    <i data-lucide="edit" class="h-4 w-4"></i>
                </button>
                <button class="text-red-600 hover:text-red-800" onclick="deleteLessonFAQs(${faq.lesson_id})">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Re-initialize Lucide icons for the new content
    lucide.createIcons();
}

// Delete all FAQs for a lesson
function deleteLessonFAQs(lessonId) {
    if (confirm('Tem certeza que deseja excluir todos os FAQs desta aula?')) {
        fetch(`/api/faq/lesson/${lessonId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast(data.message, 'success');
                loadFAQs();
                loadFAQStats();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting lesson FAQs:', error);
            showToast('Erro ao excluir os FAQs', 'error');
        });
    }
}

// Update pagination controls
function updatePagination(total, pages, currentPageNum) {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';
    
    totalPages = pages;
    currentPage = currentPageNum;
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = `Mostrando ${total > 0 ? ((currentPage - 1) * perPage + 1) : 0}-${Math.min(currentPage * perPage, total)} de ${total} aulas com FAQ`;
    
    // If no pages or only one page, hide pagination
    if (pages <= 1) {
        return;
    }
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = `pagination-btn ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`;
    prevBtn.innerHTML = '<i data-lucide="chevron-left" class="h-4 w-4"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadFAQs();
        }
    });
    paginationDiv.appendChild(prevBtn);
    
    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(pages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            loadFAQs();
        });
        paginationDiv.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = `pagination-btn ${currentPage === pages ? 'opacity-50 cursor-not-allowed' : ''}`;
    nextBtn.innerHTML = '<i data-lucide="chevron-right" class="h-4 w-4"></i>';
    nextBtn.disabled = currentPage === pages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < pages) {
            currentPage++;
            loadFAQs();
        }
    });
    paginationDiv.appendChild(nextBtn);
    
    // Re-initialize icons
    lucide.createIcons();
}

// Load courses for dropdown
function loadCourses() {
    fetch('/api/faq/courses')
        .then(response => response.json())
        .then(courses => {
            const formSelect = document.getElementById('formCourseSelect');
            const filterSelect = document.getElementById('courseFilter');
            
            formSelect.innerHTML = '<option value="">Selecione um curso</option>';
            filterSelect.innerHTML = '<option value="">Todos os cursos</option>';
            
            courses.forEach(course => {
                const formOption = document.createElement('option');
                formOption.value = course.id;
                formOption.textContent = course.name;
                formSelect.appendChild(formOption);
                
                const filterOption = document.createElement('option');
                filterOption.value = course.id;
                filterOption.textContent = course.name;
                filterSelect.appendChild(filterOption);
            });
        })
        .catch(error => console.error('Error loading courses:', error));
}

// Load modules for a selected course
function loadModules(courseId, targetId) {
    fetch(`/api/faq/course/${courseId}/modules`)
        .then(response => response.json())
        .then(modules => {
            const select = document.getElementById(targetId);
            
            if (targetId === 'formModuleSelect') {
                select.innerHTML = '<option value="">Selecione um módulo</option>';
            } else {
                select.innerHTML = '<option value="">Todos os módulos</option>';
            }
            
            modules.forEach(module => {
                const option = document.createElement('option');
                option.value = module.id;
                option.textContent = module.name;
                select.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading modules:', error));
}

// Load lessons for a selected module
function loadLessons(moduleId) {
    fetch(`/api/faq/module/${moduleId}/lessons`)
        .then(response => response.json())
        .then(lessons => {
            const select = document.getElementById('formLessonSelect');
            select.innerHTML = '<option value="">Selecione uma aula</option>';
            
            if (lessons.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Todas as aulas deste módulo já possuem FAQ";
                option.disabled = true;
                select.appendChild(option);
            } else {
                lessons.forEach(lesson => {
                    const option = document.createElement('option');
                    option.value = lesson.id;
                    option.textContent = lesson.title;
                    select.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Error loading lessons:', error));
}

// Load FAQ statistics
function loadFAQStats() {
    fetch('/api/faq/stats')
        .then(response => response.json())
        .then(stats => {
            document.getElementById('totalFAQs').textContent = stats.total_faqs || 0;
            document.getElementById('lessonsWithFAQs').textContent = stats.lessons_with_faqs || 0;
            
            // Calculate average FAQs per lesson
            const average = stats.total_faqs > 0 && stats.lessons_with_faqs > 0
                ? (stats.total_faqs / stats.lessons_with_faqs).toFixed(1)
                : 0;
            document.getElementById('averageFAQs').textContent = average;
        })
        .catch(error => console.error('Error loading FAQ stats:', error));
}

// Show FAQ modal
function showFAQModal() {
    // Reset form
    document.getElementById('faqForm').reset();
    document.getElementById('modalTitle').textContent = 'Novo FAQ';
    
    // Reset dropdowns
    document.getElementById('formModuleSelect').disabled = true;
    document.getElementById('formLessonSelect').disabled = true;
    document.getElementById('formModuleSelect').innerHTML = '<option value="">Selecione um módulo</option>';
    document.getElementById('formLessonSelect').innerHTML = '<option value="">Selecione uma aula</option>';
    
    // Reset FAQ form
    resetFaqForm();
    
    // Show modal
    document.getElementById('faqModal').style.display = 'block';
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

// Reset FAQ form to initial state with 3 empty FAQ pairs
function resetFaqForm() {
    // Clear any existing FAQ pairs and reset to default 3
    const container = document.getElementById('faqPairsContainer');
    container.innerHTML = '';
    
    // Add initial 3 FAQ pairs
    for (let i = 0; i < 3; i++) {
        addFAQPairToContainer(i, '', '', i < 2);
    }
    
    // Update counter
    updateFAQCounter();
}

// Add new FAQ pair
function addNewFAQPair() {
    const container = document.getElementById('faqPairsContainer');
    const currentCount = container.children.length;
    
    // Max 10 FAQs
    if (currentCount >= 10) {
        showToast('Você atingiu o limite máximo de 10 perguntas', 'warning');
        return;
    }
    
    addFAQPairToContainer(currentCount, '', '', true);
    updateFAQCounter();
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

// Add FAQ pair to container
function addFAQPairToContainer(index, question = '', answer = '', removable = true) {
    const container = document.getElementById('faqPairsContainer');
    
    const faqPair = document.createElement('div');
    faqPair.className = 'faq-form-pair';
    faqPair.dataset.index = index;
    
    const number = index + 1;
    
    faqPair.innerHTML = `
        <button type="button" class="remove-btn" ${removable ? '' : 'disabled'}>
            <i data-lucide="x-circle" class="h-5 w-5"></i>
        </button>
        <div class="mb-4">
            <label for="question_${index}">Pergunta ${number}</label>
            <input type="text" id="question_${index}" name="question[]" required placeholder="Digite a pergunta" value="${escapeHtml(question)}">
        </div>
        <div>
            <label for="answer_${index}">Resposta</label>
            <textarea id="answer_${index}" name="answer[]" required placeholder="Digite a resposta" class="text-sm">${escapeHtml(answer)}</textarea>
        </div>
    `;
    
    container.appendChild(faqPair);
    
    // Add remove event listener if removable
    if (removable) {
        const removeBtn = faqPair.querySelector('.remove-btn');
        removeBtn.addEventListener('click', function() {
            faqPair.remove();
            
            // Renumber the remaining FAQ pairs
            reindexFAQPairs();
            
            // Update counter
            updateFAQCounter();
            
            // Enable remove button on the first three items if there are more than 3
            const currentCount = container.children.length;
            if (currentCount > 3) {
                for (let i = 0; i < Math.min(3, currentCount); i++) {
                    container.children[i].querySelector('.remove-btn').disabled = false;
                }
            }
        });
    }
}

// Reindex FAQ pairs after removal
function reindexFAQPairs() {
    const container = document.getElementById('faqPairsContainer');
    const pairs = container.children;
    
    Array.from(pairs).forEach((pair, index) => {
        pair.dataset.index = index;
        
        const number = index + 1;
        const questionLabel = pair.querySelector('label[for^="question_"]');
        const questionInput = pair.querySelector('input[name="question[]"]');
        const answerLabel = pair.querySelector('label[for^="answer_"]');
        const answerTextarea = pair.querySelector('textarea[name="answer[]"]');
        
        questionLabel.setAttribute('for', `question_${index}`);
        questionLabel.textContent = `Pergunta ${number}`;
        questionInput.id = `question_${index}`;
        
        answerLabel.setAttribute('for', `answer_${index}`);
        answerTextarea.id = `answer_${index}`;
        
        // Update remove button status
        const removeBtn = pair.querySelector('.remove-btn');
        removeBtn.disabled = index < 3 && container.children.length <= 3;
    });
}

// Update FAQ counter
function updateFAQCounter() {
    const container = document.getElementById('faqPairsContainer');
    const count = container.children.length;
    document.getElementById('faqCounter').textContent = count;
    
    // Show/hide add button based on count
    const addBtn = document.getElementById('addFaqButton');
    if (count >= 10) {
        addBtn.style.display = 'none';
    } else {
        addBtn.style.display = 'block';
    }
}

// Submit FAQ form
function submitFAQForm() {
    const form = document.getElementById('faqForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const lessonId = document.getElementById('formLessonSelect').value;
    
    if (!lessonId) {
        showToast('Por favor, selecione uma aula', 'error');
        return;
    }
    
    const container = document.getElementById('faqPairsContainer');
    const faqCount = container.children.length;
    
    if (faqCount < 3) {
        showToast('É necessário pelo menos 3 perguntas', 'error');
        return;
    }
    
    // Collect FAQ data
    const faqs = [];
    for (let i = 0; i < faqCount; i++) {
        const question = document.getElementById(`question_${i}`).value.trim();
        const answer = document.getElementById(`answer_${i}`).value.trim();
        
        if (question && answer) {
            faqs.push({
                question: question,
                answer: answer
            });
        }
    }
    
    // Check if we're editing or creating
    let url = '/api/faq/create';
    let method = 'POST';
    
    // If we found existing FAQs earlier, use update endpoint
    if (document.getElementById('modalTitle').textContent === 'Editar FAQ') {
        url = `/api/faq/update/${lessonId}`;
        method = 'PUT';
    }
    
    // Submit to server
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lesson_id: lessonId,
            faqs: faqs
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message, 'success');
            document.getElementById('faqModal').style.display = 'none';
            loadFAQs();
            loadFAQStats();
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error submitting FAQ:', error);
        showToast('Erro ao salvar o FAQ', 'error');
    });
}

// View FAQ details
function viewFAQDetails(lessonId) {
    fetch(`/api/faq/lesson-info/${lessonId}`)
        .then(response => response.json())
        .then(info => {
            document.getElementById('detailsCourseName').textContent = info.course.name;
            document.getElementById('detailsModuleName').textContent = info.module.name;
            document.getElementById('detailsLessonName').textContent = info.lesson.title;
            
            fetch(`/api/faq/lesson/${lessonId}`)
                .then(response => response.json())
                .then(faqs => {
                    const detailsList = document.getElementById('faqDetailsList');
                    detailsList.innerHTML = '';
                    
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
                        
                        detailsList.appendChild(faqItem);
                    });
                    
                    document.getElementById('faqDetailsModal').style.display = 'block';
                    
                    // Re-initialize Lucide icons
                    lucide.createIcons();
                })
                .catch(error => console.error('Error loading FAQ details:', error));
        })
        .catch(error => console.error('Error loading lesson info:', error));
}

// Toggle FAQ item in details view
function toggleFAQItem(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('hidden');
    
    const icon = header.querySelector('[data-lucide]');
    if (content.classList.contains('hidden')) {
        icon.setAttribute('data-lucide', 'chevron-down');
    } else {
        icon.setAttribute('data-lucide', 'chevron-up');
    }
    
    // Re-initialize the icon
    lucide.createIcons({
        icons: {
            [icon.getAttribute('data-lucide')]: icon
        }
    });
}

// Edit FAQ
function editFAQ(lessonId) {
    // Get lesson info first
    fetch(`/api/faq/lesson-info/${lessonId}`)
        .then(response => response.json())
        .then(info => {
            // Setup modal
            document.getElementById('modalTitle').textContent = 'Editar FAQ';
            document.getElementById('faqModal').style.display = 'block';
            
            // Set course dropdown
            const courseSelect = document.getElementById('formCourseSelect');
            courseSelect.value = info.course.id;
            
            // Load modules
            loadModules(info.course.id, 'formModuleSelect');
            document.getElementById('formModuleSelect').disabled = false;
            
            // After modules are loaded, select the correct module
            setTimeout(() => {
                const moduleSelect = document.getElementById('formModuleSelect');
                moduleSelect.value = info.module.id;
                
                // Create a custom options array for just this lesson
                const lessonSelect = document.getElementById('formLessonSelect');
                lessonSelect.innerHTML = '<option value="">Selecione uma aula</option>';
                
                const option = document.createElement('option');
                option.value = info.lesson.id;
                option.textContent = info.lesson.title;
                lessonSelect.appendChild(option);
                
                lessonSelect.value = info.lesson.id;
                lessonSelect.disabled = false;
                selectedLessonId = info.lesson.id;
                
                // Load the FAQs for that lesson
                fetch(`/api/faq/lesson/${lessonId}`)
                    .then(response => response.json())
                    .then(faqs => {
                        populateFormWithExistingFAQs(faqs);
                    })
                    .catch(error => console.error('Error loading lesson FAQs:', error));
            }, 500);
        })
        .catch(error => console.error('Error loading lesson info:', error));
}

// Populate form with existing FAQs
function populateFormWithExistingFAQs(faqs) {
    const container = document.getElementById('faqPairsContainer');
    container.innerHTML = '';
    
    // Add all FAQs
    faqs.forEach((faq, index) => {
        addFAQPairToContainer(index, faq.question, faq.answer, index >= 3 || faqs.length > 3);
    });
    
    // Enable remove buttons if we have more than 3 FAQs
    if (faqs.length > 3) {
        Array.from(container.children).forEach(pair => {
            pair.querySelector('.remove-btn').disabled = false;
        });
    }
    
    // Update counter
    updateFAQCounter();
    
    // Re-initialize Lucide icons
    lucide.createIcons();
}

// Delete FAQ
function deleteFAQ(faqId) {
    if (confirm('Tem certeza que deseja excluir este FAQ?')) {
        fetch(`/api/faq/${faqId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast(data.message, 'success');
                loadFAQs();
                loadFAQStats();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting FAQ:', error);
            showToast('Erro ao excluir o FAQ', 'error');
        });
    }
}

// Utility Functions

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Show toast notification
function showToast(message, type = 'success') {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `flex items-center p-4 mb-4 w-full max-w-xs text-gray-500 rounded-lg shadow transition-opacity duration-300 ${
        type === 'success' ? 'bg-green-50' :
        type === 'error' ? 'bg-red-50' :
        type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
    }`;
    
    // Icon based on type
    const iconName = 
        type === 'success' ? 'check-circle' :
        type === 'error' ? 'alert-circle' :
        type === 'warning' ? 'alert-triangle' : 'info';
    
    const iconColor = 
        type === 'success' ? 'text-green-500' :
        type === 'error' ? 'text-red-500' :
        type === 'warning' ? 'text-yellow-500' : 'text-blue-500';
    
    toast.innerHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 ${iconColor}">
            <i data-lucide="${iconName}" class="h-5 w-5"></i>
        </div>
        <div class="ml-3 text-sm font-normal">${escapeHtml(message)}</div>
        <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg p-1.5 hover:bg-gray-100 inline-flex h-8 w-8">
            <i data-lucide="x" class="h-5 w-5"></i>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Add close button functionality
    toast.querySelector('button').addEventListener('click', () => {
        toast.classList.add('opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}