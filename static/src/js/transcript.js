/**
 * Transcript Manager JavaScript
 */

// Global variables
let currentPage = 1;
const perPage = 10;
let totalPages = 0;
let selectedLessonId = null;
let currentTranscriptId = null;

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Load initial data
    loadTranscripts();
    loadCourses();
    loadStats();
    
    // Set up event listeners
    setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
    // Close modal buttons
    document.querySelectorAll('.close').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('transcriptModal').style.display = 'none';
            document.getElementById('youtubeModal').style.display = 'none';
            document.getElementById('transcriptDetailsModal').style.display = 'none';
            
            // Reset form states
            document.getElementById('youtubeErrorState').style.display = 'none';
            document.getElementById('youtubeLoadingState').style.display = 'none';
        });
    });
    
    // Click outside modal to close
    window.addEventListener('click', event => {
        const transcriptModal = document.getElementById('transcriptModal');
        const youtubeModal = document.getElementById('youtubeModal');
        const detailsModal = document.getElementById('transcriptDetailsModal');
        
        if (event.target === transcriptModal) {
            transcriptModal.style.display = 'none';
        }
        
        if (event.target === youtubeModal) {
            youtubeModal.style.display = 'none';
        }
        
        if (event.target === detailsModal) {
            detailsModal.style.display = 'none';
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
            checkLessonHasTranscript(selectedLessonId);
            
            // Also check for YouTube video
            fetch(`/api/transcript/lesson-info/${selectedLessonId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.lesson.video_type === 'youtube' && data.lesson.video_url) {
                        document.getElementById('youtubeTranscriptionTools').style.display = 'block';
                    } else {
                        document.getElementById('youtubeTranscriptionTools').style.display = 'none';
                    }
                })
                .catch(error => console.error('Error getting lesson info:', error));
        }
    });
    
    // Add transcript button
    document.getElementById('addTranscriptButton').addEventListener('click', function() {
        showTranscriptModal();
    });
    
    // Delete transcript button
    document.getElementById('deleteTranscript').addEventListener('click', function() {
        if (currentTranscriptId && confirm('Tem certeza que deseja excluir esta transcrição?')) {
            deleteTranscript(currentTranscriptId);
        }
    });
    
    // Cancel transcript button
    document.getElementById('cancelTranscript').addEventListener('click', function() {
        document.getElementById('transcriptModal').style.display = 'none';
    });
    
    // YouTube import button
    document.getElementById('getYoutubeTranscription').addEventListener('click', function() {
        if (selectedLessonId) {
            document.getElementById('youtubeModal').style.display = 'block';
        } else {
            alert('Por favor, selecione uma aula primeiro.');
        }
    });
    
    // Generate vector button
    document.getElementById('generateVector').addEventListener('click', function() {
        const transcriptText = document.getElementById('transcriptText').value;
        if (!transcriptText.trim()) {
            alert('Por favor, adicione uma transcrição primeiro.');
            return;
        }
        
        const lessonSelect = document.getElementById('formLessonSelect');
        const moduleSelect = document.getElementById('formModuleSelect');
        const courseSelect = document.getElementById('formCourseSelect');
        
        const lessonTitle = lessonSelect.options[lessonSelect.selectedIndex].text;
        const moduleName = moduleSelect.options[moduleSelect.selectedIndex].text;
        const courseName = courseSelect.options[courseSelect.selectedIndex].text;
        
        generateMetadata('vector', transcriptText, lessonTitle, moduleName, courseName);
    });
    
    // Generate keywords button
    document.getElementById('generateKeywords').addEventListener('click', function() {
        const transcriptText = document.getElementById('transcriptText').value;
        if (!transcriptText.trim()) {
            alert('Por favor, adicione uma transcrição primeiro.');
            return;
        }
        
        const lessonSelect = document.getElementById('formLessonSelect');
        const moduleSelect = document.getElementById('formModuleSelect');
        const courseSelect = document.getElementById('formCourseSelect');
        
        const lessonTitle = lessonSelect.options[lessonSelect.selectedIndex].text;
        const moduleName = moduleSelect.options[moduleSelect.selectedIndex].text;
        const courseName = courseSelect.options[courseSelect.selectedIndex].text;
        
        generateMetadata('keywords', transcriptText, lessonTitle, moduleName, courseName);
    });
    
    // YouTube import form
    document.getElementById('youtubeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        document.getElementById('submitYoutube').disabled = true;
        document.getElementById('youtubeLoadingState').style.display = 'block';
        document.getElementById('youtubeErrorState').style.display = 'none';
        
        const youtubeUrl = document.getElementById('youtubeUrl').value;
        const provider = document.getElementById('aiProvider').value;
        
        // Call the faq_ai endpoint for generating transcription from YouTube
        fetch('/api/faq-ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lesson_id: selectedLessonId,
                generate_faq: false,
                model: provider === 'groq' ? 'deepseek-r1-distill-llama-70b' : 'gpt-3.5-turbo',
                provider: provider
            }),
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('youtubeLoadingState').style.display = 'none';
            document.getElementById('submitYoutube').disabled = false;
            
            if (data.success) {
                // Close YouTube modal
                document.getElementById('youtubeModal').style.display = 'none';
                
                // Fetch the transcript data
                fetch(`/api/transcript/lesson/${selectedLessonId}`)
                    .then(response => response.json())
                    .then(transcriptData => {
                        if (transcriptData.transcript_text) {
                            document.getElementById('transcriptText').value = transcriptData.transcript_text;
                            document.getElementById('transcriptVector').value = transcriptData.transcript_vector || '';
                            document.getElementById('searchableKeywords').value = transcriptData.searchable_keywords || '';
                            
                            // Show success message
                            showToast('Transcrição importada com sucesso do YouTube!', 'success');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching transcript after generation:', error);
                        showToast('Erro ao obter a transcrição gerada.', 'error');
                    });
            } else {
                document.getElementById('youtubeErrorState').style.display = 'block';
                document.getElementById('youtubeErrorMessage').textContent = data.message || 'Ocorreu um erro ao processar o vídeo.';
            }
        })
        .catch(error => {
            console.error('Error generating transcript:', error);
            document.getElementById('youtubeLoadingState').style.display = 'none';
            document.getElementById('submitYoutube').disabled = false;
            document.getElementById('youtubeErrorState').style.display = 'block';
            document.getElementById('youtubeErrorMessage').textContent = 'Erro de conexão ao processar o vídeo.';
        });
    });
    
    // Cancel YouTube import
    document.getElementById('cancelYoutube').addEventListener('click', function() {
        document.getElementById('youtubeModal').style.display = 'none';
    });
    
    // Edit from details button
    document.getElementById('editFromDetails').addEventListener('click', function() {
        document.getElementById('transcriptDetailsModal').style.display = 'none';
        
        if (currentTranscriptId) {
            editTranscript(currentTranscriptId);
        }
    });
    
    // Filter change events
    document.getElementById('courseFilter').addEventListener('change', function() {
        const courseId = this.value;
        
        if (courseId) {
            loadModules(courseId, 'moduleFilter');
            document.getElementById('moduleFilter').disabled = false;
        } else {
            document.getElementById('moduleFilter').disabled = true;
            document.getElementById('moduleFilter').innerHTML = '<option value="">Selecione um módulo</option>';
        }
        
        currentPage = 1;
        loadTranscripts();
    });
    
    document.getElementById('moduleFilter').addEventListener('change', function() {
        currentPage = 1;
        loadTranscripts();
    });
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', debounce(function() {
        currentPage = 1;
        loadTranscripts();
    }, 300));
    
    // Transcript form submission
    document.getElementById('transcriptForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitTranscriptForm();
    });
}

// Check if a lesson already has a transcript
function checkLessonHasTranscript(lessonId) {
    fetch(`/api/transcript/lesson-has-transcript/${lessonId}`)
        .then(response => response.json())
        .then(data => {
            const deleteBtn = document.getElementById('deleteTranscript');
            if (data.has_transcript) {
                // If transcript exists, load it
                fetch(`/api/transcript/lesson/${lessonId}`)
                    .then(response => response.json())
                    .then(transcript => {
                        // Populate form with existing data
                        document.getElementById('transcriptText').value = transcript.transcript_text || '';
                        document.getElementById('transcriptVector').value = transcript.transcript_vector || '';
                        document.getElementById('searchableKeywords').value = transcript.searchable_keywords || '';
                        
                        // Store the transcript ID
                        currentTranscriptId = transcript.id;
                        
                        // Show delete button
                        deleteBtn.style.display = 'inline-block';
                    })
                    .catch(error => console.error('Error loading transcript:', error));
            } else {
                // If no transcript exists, reset form fields
                document.getElementById('transcriptText').value = '';
                document.getElementById('transcriptVector').value = '';
                document.getElementById('searchableKeywords').value = '';
                currentTranscriptId = null;
                
                // Hide delete button
                deleteBtn.style.display = 'none';
            }
        })
        .catch(error => console.error('Error checking lesson transcript:', error));
}

// Load transcripts with filters and pagination
function loadTranscripts() {
    const searchQuery = document.getElementById('searchInput').value;
    const courseId = document.getElementById('courseFilter').value;
    const moduleId = document.getElementById('moduleFilter').value;
    
    // Show loading state
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('transcriptTableBody').innerHTML = '';
    
    const url = `/api/transcripts?page=${currentPage}&search=${encodeURIComponent(searchQuery)}&course=${courseId}&module=${moduleId}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Hide loading state
            document.getElementById('loadingState').style.display = 'none';
            
            if (data.transcripts && data.transcripts.length > 0) {
                displayTranscripts(data.transcripts);
                updatePagination(data.total, data.pages, data.current_page);
                document.getElementById('totalItems').textContent = data.total;
            } else {
                document.getElementById('emptyState').style.display = 'block';
                document.getElementById('totalItems').textContent = '0';
                updatePagination(0, 0, 1);
            }
        })
        .catch(error => {
            console.error('Error loading transcripts:', error);
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('totalItems').textContent = '0';
            showToast('Erro ao carregar transcrições.', 'error');
        });
}

// Display transcripts in the table
function displayTranscripts(transcripts) {
    const tableBody = document.getElementById('transcriptTableBody');
    tableBody.innerHTML = '';
    
    transcripts.forEach(transcript => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        
        // Format text length to KB or MB
        let sizeText = '';
        const sizeInKB = Math.round(transcript.text_length / 1024 * 10) / 10;
        if (sizeInKB < 1024) {
            sizeText = sizeInKB + ' KB';
        } else {
            sizeText = Math.round(sizeInKB / 1024 * 10) / 10 + ' MB';
        }
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${escapeHtml(transcript.lesson_title)}</div>
                <div class="text-sm text-gray-500">${transcript.word_count} palavras</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${escapeHtml(transcript.module_name)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${escapeHtml(transcript.course_name)}</div>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="text-sm text-gray-900">${sizeText}</div>
                <div class="text-xs text-gray-500">${transcript.keywords_length ? (transcript.keywords_length + ' caracteres') : 'Sem palavras-chave'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="text-sm text-gray-900">${transcript.updated_at || transcript.created_at}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button onclick="viewTranscriptDetails(${transcript.lesson_id})" class="p-1.5 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors" title="Ver detalhes">
                        <i data-lucide="eye" class="h-4 w-4 text-blue-600"></i>
                    </button>
                    <button onclick="editTranscript(${transcript.lesson_id})" class="p-1.5 bg-green-100 rounded-md hover:bg-green-200 transition-colors" title="Editar transcrição">
                        <i data-lucide="edit" class="h-4 w-4 text-green-600"></i>
                    </button>
                    <button onclick="deleteTranscript(${transcript.id})" class="p-1.5 bg-red-100 rounded-md hover:bg-red-200 transition-colors" title="Excluir transcrição">
                        <i data-lucide="trash-2" class="h-4 w-4 text-red-600"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Re-initialize Lucide icons for the new content
    lucide.createIcons();
}

// Delete transcript
function deleteTranscript(transcriptId) {
    if (!confirm('Tem certeza que deseja excluir esta transcrição?')) {
        return;
    }
    
    fetch(`/api/transcript/${transcriptId}`, {
        method: 'DELETE',
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close modal if open
            document.getElementById('transcriptModal').style.display = 'none';
            document.getElementById('transcriptDetailsModal').style.display = 'none';
            
            // Reload transcripts
            loadTranscripts();
            loadStats();
            
            showToast('Transcrição excluída com sucesso.', 'success');
        } else {
            showToast(data.message || 'Erro ao excluir transcrição.', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting transcript:', error);
        showToast('Erro de conexão ao excluir transcrição.', 'error');
    });
}

// Update pagination controls
function updatePagination(total, pages, currentPageNum) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    if (pages <= 1) {
        return;
    }
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = `pagination-btn ${currentPageNum === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`;
    prevButton.innerHTML = '<i data-lucide="chevron-left" class="h-4 w-4"></i>';
    prevButton.disabled = currentPageNum === 1;
    prevButton.addEventListener('click', function() {
        if (currentPageNum > 1) {
            currentPage = currentPageNum - 1;
            loadTranscripts();
        }
    });
    paginationContainer.appendChild(prevButton);
    
    // Page numbers
    let startPage = Math.max(1, currentPageNum - 2);
    let endPage = Math.min(pages, currentPageNum + 2);
    
    // Ensure we show at least 5 pages if possible
    if (endPage - startPage < 4) {
        if (startPage === 1) {
            endPage = Math.min(pages, startPage + 4);
        } else if (endPage === pages) {
            startPage = Math.max(1, endPage - 4);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn ${i === currentPageNum ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-200'}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', function() {
            currentPage = i;
            loadTranscripts();
        });
        paginationContainer.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = `pagination-btn ${currentPageNum === pages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`;
    nextButton.innerHTML = '<i data-lucide="chevron-right" class="h-4 w-4"></i>';
    nextButton.disabled = currentPageNum === pages;
    nextButton.addEventListener('click', function() {
        if (currentPageNum < pages) {
            currentPage = currentPageNum + 1;
            loadTranscripts();
        }
    });
    paginationContainer.appendChild(nextButton);
    
    // Re-initialize Lucide icons for the new content
    lucide.createIcons();
}

// Load courses for dropdown
function loadCourses() {
    // Load for both filter and form
    fetch('/api/transcript/courses')
        .then(response => response.json())
        .then(courses => {
            const filterSelect = document.getElementById('courseFilter');
            const formSelect = document.getElementById('formCourseSelect');
            
            // Clear existing options except the first one
            filterSelect.innerHTML = '<option value="">Todos os cursos</option>';
            formSelect.innerHTML = '<option value="">Selecione um curso</option>';
            
            courses.forEach(course => {
                const filterOption = document.createElement('option');
                filterOption.value = course.id;
                filterOption.textContent = course.name;
                filterSelect.appendChild(filterOption);
                
                const formOption = document.createElement('option');
                formOption.value = course.id;
                formOption.textContent = course.name;
                formSelect.appendChild(formOption);
            });
        })
        .catch(error => console.error('Error loading courses:', error));
}

// Load modules for a selected course
function loadModules(courseId, targetId) {
    fetch(`/api/transcript/course/${courseId}/modules`)
        .then(response => response.json())
        .then(modules => {
            const select = document.getElementById(targetId);
            
            // Clear existing options except the first one
            if (targetId === 'moduleFilter') {
                select.innerHTML = '<option value="">Todos os módulos</option>';
            } else {
                select.innerHTML = '<option value="">Selecione um módulo</option>';
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
    fetch(`/api/transcript/module/${moduleId}/lessons`)
        .then(response => response.json())
        .then(lessons => {
            const select = document.getElementById('formLessonSelect');
            select.innerHTML = '<option value="">Selecione uma aula</option>';
            
            lessons.forEach(lesson => {
                const option = document.createElement('option');
                option.value = lesson.id;
                option.textContent = lesson.title;
                select.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading lessons:', error));
}

// Load transcript statistics
function loadStats() {
    fetch('/api/transcript/stats')
        .then(response => response.json())
        .then(stats => {
            document.getElementById('totalTranscriptsCount').textContent = stats.total_transcripts;
            document.getElementById('coursesWithTranscriptsCount').textContent = stats.courses_with_transcripts;
            document.getElementById('keywordsCount').textContent = stats.unique_keywords_count;
        })
        .catch(error => console.error('Error loading stats:', error));
}

// Show transcript modal
function showTranscriptModal() {
    // Reset form
    resetTranscriptForm();
    
    // Reset current transcript ID
    currentTranscriptId = null;
    
    // Set modal title
    document.getElementById('modalTitle').textContent = 'Nova Transcrição';
    
    // Hide delete button
    document.getElementById('deleteTranscript').style.display = 'none';
    
    // Hide YouTube tools until a lesson is selected
    document.getElementById('youtubeTranscriptionTools').style.display = 'none';
    
    // Show modal
    document.getElementById('transcriptModal').style.display = 'block';
}

// Reset transcript form to initial state
function resetTranscriptForm() {
    const form = document.getElementById('transcriptForm');
    form.reset();
    
    // Reset select elements
    document.getElementById('formModuleSelect').disabled = true;
    document.getElementById('formLessonSelect').disabled = true;
    document.getElementById('formModuleSelect').innerHTML = '<option value="">Selecione um módulo</option>';
    document.getElementById('formLessonSelect').innerHTML = '<option value="">Selecione uma aula</option>';
}

// Submit transcript form
function submitTranscriptForm() {
    const lessonId = document.getElementById('formLessonSelect').value;
    const transcriptText = document.getElementById('transcriptText').value;
    const transcriptVector = document.getElementById('transcriptVector').value;
    const searchableKeywords = document.getElementById('searchableKeywords').value;
    
    if (!lessonId) {
        showToast('Por favor, selecione uma aula.', 'error');
        return;
    }
    
    if (!transcriptText.trim()) {
        showToast('Por favor, adicione uma transcrição.', 'error');
        return;
    }
    
    // Prepare data
    const data = {
        lesson_id: lessonId,
        transcript_text: transcriptText,
        transcript_vector: transcriptVector,
        searchable_keywords: searchableKeywords
    };
    
    // Send request
    fetch('/api/transcript/create-update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close modal
            document.getElementById('transcriptModal').style.display = 'none';
            
            // Reload transcripts
            loadTranscripts();
            loadStats();
            
            showToast(data.message, 'success');
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error submitting transcript:', error);
        showToast('Erro de conexão ao salvar transcrição.', 'error');
    });
}

// View transcript details
function viewTranscriptDetails(transcriptId) {
    fetch(`/api/transcript/lesson/${transcriptId}`)
        .then(response => response.json())
        .then(transcript => {
            // Store current transcript ID
            currentTranscriptId = transcript.id;
            
            // Set header information
            document.getElementById('detailsTitle').textContent = transcript.lesson_title;
            document.getElementById('detailsCourse').textContent = transcript.course_name;
            document.getElementById('detailsModule').textContent = transcript.module_name;
            document.getElementById('detailsLesson').textContent = transcript.lesson_title;
            
            // Set transcript content
            document.getElementById('detailsTranscriptText').textContent = transcript.transcript_text || '-';
            document.getElementById('detailsVector').textContent = transcript.transcript_vector || '-';
            document.getElementById('detailsWordCount').textContent = `${transcript.word_count || 0} palavras`;
            
            // Set keywords as badges
            const keywordsContainer = document.getElementById('detailsKeywordsContainer');
            keywordsContainer.innerHTML = '';
            
            if (transcript.searchable_keywords) {
                const keywords = transcript.searchable_keywords.split(',').map(k => k.trim()).filter(k => k);
                keywords.forEach(keyword => {
                    const badge = document.createElement('span');
                    badge.className = 'inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 mb-2 px-2.5 py-0.5 rounded';
                    badge.textContent = keyword;
                    keywordsContainer.appendChild(badge);
                });
            } else {
                keywordsContainer.textContent = 'Nenhuma palavra-chave definida.';
            }
            
            // Set timestamps
            document.getElementById('detailsCreatedAt').textContent = transcript.created_at || '-';
            document.getElementById('detailsUpdatedAt').textContent = transcript.updated_at || transcript.created_at || '-';
            
            // Show modal
            document.getElementById('transcriptDetailsModal').style.display = 'block';
        })
        .catch(error => {
            console.error('Error loading transcript details:', error);
            showToast('Erro ao carregar detalhes da transcrição.', 'error');
        });
}

// Edit transcript
function editTranscript(transcriptId) {
    fetch(`/api/transcript/lesson/${transcriptId}`)
        .then(response => response.json())
        .then(transcript => {
            // Store current transcript ID
            currentTranscriptId = transcript.id;
            
            // Set modal title
            document.getElementById('modalTitle').textContent = 'Editar Transcrição';
            
            // Load course, then module, then lesson
            fetch('/api/transcript/courses')
                .then(response => response.json())
                .then(courses => {
                    const courseSelect = document.getElementById('formCourseSelect');
                    courseSelect.innerHTML = '<option value="">Selecione um curso</option>';
                    
                    courses.forEach(course => {
                        const option = document.createElement('option');
                        option.value = course.id;
                        option.textContent = course.name;
                        courseSelect.appendChild(option);
                    });
                    
                    // Select the correct course
                    courseSelect.value = transcript.course_id;
                    
                    // Load modules
                    loadModules(transcript.course_id, 'formModuleSelect');
                    document.getElementById('formModuleSelect').disabled = false;
                    
                    // After modules are loaded, select the correct module
                    setTimeout(() => {
                        const moduleSelect = document.getElementById('formModuleSelect');
                        moduleSelect.value = transcript.module_id;
                        
                        // Load lessons
                        loadLessons(transcript.module_id);
                        document.getElementById('formLessonSelect').disabled = false;
                        
                        // After lessons are loaded, select the correct lesson
                        setTimeout(() => {
                            const lessonSelect = document.getElementById('formLessonSelect');
                            lessonSelect.value = transcript.lesson_id;
                            selectedLessonId = transcript.lesson_id;
                            
                            // Check for YouTube video
                            fetch(`/api/transcript/lesson-info/${transcript.lesson_id}`)
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success && data.lesson.video_type === 'youtube' && data.lesson.video_url) {
                                        document.getElementById('youtubeTranscriptionTools').style.display = 'block';
                                    } else {
                                        document.getElementById('youtubeTranscriptionTools').style.display = 'none';
                                    }
                                })
                                .catch(error => console.error('Error getting lesson info:', error));
                        }, 300);
                    }, 300);
                })
                .catch(error => console.error('Error loading courses:', error));
                
            // Fill form fields
            document.getElementById('transcriptText').value = transcript.transcript_text || '';
            document.getElementById('transcriptVector').value = transcript.transcript_vector || '';
            document.getElementById('searchableKeywords').value = transcript.searchable_keywords || '';
            
            // Show delete button
            document.getElementById('deleteTranscript').style.display = 'inline-block';
            
            // Show modal
            document.getElementById('transcriptModal').style.display = 'block';
        })
        .catch(error => {
            console.error('Error loading transcript for editing:', error);
            showToast('Erro ao carregar transcrição para edição.', 'error');
        });
}

// Generate metadata (vector or keywords) using AI
function generateMetadata(type, transcriptText, lessonTitle, moduleName, courseName) {
    // Get AI provider
    const provider = document.getElementById('aiProvider').value || 'groq';
    
    // Show loading indicator
    const button = document.getElementById(type === 'vector' ? 'generateVector' : 'generateKeywords');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-2" class="h-3.5 w-3.5 mr-1 animate-spin"></i> Gerando...';
    lucide.createIcons();
    
    // Prepare data
    const data = {
        transcript_text: transcriptText,
        lesson_title: lessonTitle,
        module_name: moduleName,
        course_name: courseName,
        provider: provider
    };
    
    // Send request
    fetch('/api/transcript/generate-metadata', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (type === 'vector' && data.transcript_vector) {
                document.getElementById('transcriptVector').value = data.transcript_vector;
            }
            
            if (type === 'keywords' && data.searchable_keywords) {
                document.getElementById('searchableKeywords').value = data.searchable_keywords;
            }
            
            showToast(`${type === 'vector' ? 'Resumo' : 'Palavras-chave'} gerado com sucesso!`, 'success');
        } else {
            showToast(data.message || `Erro ao gerar ${type === 'vector' ? 'resumo' : 'palavras-chave'}.`, 'error');
        }
    })
    .catch(error => {
        console.error(`Error generating ${type}:`, error);
        showToast(`Erro de conexão ao gerar ${type === 'vector' ? 'resumo' : 'palavras-chave'}.`, 'error');
    })
    .finally(() => {
        // Restore button
        button.disabled = false;
        button.innerHTML = originalText;
        lucide.createIcons();
    });
}

// Utility Functions

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Show toast notification
function showToast(message, type = 'success') {
    // Check if toast container exists, create it if not
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-md shadow-md flex items-center space-x-2 transition-all transform translate-y-0 opacity-100 ${
        type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`;
    
    // Icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : 'alert-circle');
    icon.className = 'h-5 w-5';
    
    // Message
    const messageSpan = document.createElement('span');
    messageSpan.className = 'text-sm font-medium';
    messageSpan.textContent = message;
    
    // Append elements
    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    toastContainer.appendChild(toast);
    
    // Initialize lucide icon
    lucide.createIcons();
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Make functions globally available
window.viewTranscriptDetails = viewTranscriptDetails;
window.editTranscript = editTranscript;
window.deleteTranscript = deleteTranscript;