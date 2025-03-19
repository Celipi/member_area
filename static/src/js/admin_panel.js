// Fetch courses
function fetchCourses() {
    fetch('/admin/courses')
        .then(response => response.json())
        .then(data => {
            populateCourseList(data);
            updateTotals(data, null);
        });
}

// Fetch courses for multi-select
function fetchCoursesForSelect() {
    fetch('/admin/courses')
        .then(response => response.json())
        .then(data => {
            const selectElement = document.getElementById('studentCourses');
            selectElement.innerHTML = '';
            data.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.name;
                selectElement.appendChild(option);
            });
        });
}

// Populate course list
function populateCourseList(courses) {
    const courseList = document.getElementById('courseList');
    courseList.innerHTML = '';
    courses.forEach(course => {
        const li = document.createElement('li');
        li.className = 'course-item';
        li.innerHTML = `
            <img src="${course.image_url || '/static/default-course-image.jpg'}" alt="${course.name}" class="course-image">
            <div class="course-content">
                <h3 class="course-title">${course.name}</h3>
                <div class="card-buttons">
                    <button class="card-button webhook" onclick="openWebhookModal('${course.uuid}')" title="Webhook">
                        <i data-lucide="link" class="h-4 w-4 mr-2"></i> Webhook
                    </button>
                    <button class="card-button edit" onclick="openEditCourseModal(${course.id})" title="Editar curso">
                        <i data-lucide="pencil" class="h-4 w-4 mr-2"></i> Editar
                    </button>
                    <button class="card-button delete" onclick="deleteCourse(${course.id})" title="Excluir curso">
                        <i data-lucide="trash-2" class="h-4 w-4 mr-2"></i> Excluir
                    </button>
                </div>
            </div>
        `;
        
        // Adiciona o evento de clique ao card
        li.addEventListener('click', function(event) {
            // Verifica se o clique não foi em um dos botões
            if (!event.target.closest('.card-button')) {
                window.location.href = `/admin/course/${course.id}/modification`;
            }
        });
        
        courseList.appendChild(li);
        
        // Inicializa os ícones Lucide nos novos elementos
        lucide.createIcons({
            attrs: {
                class: ["lucide-icon"]
            },
            elements: [li]
        });
    });
}

function openEditCourseModal(id) {
    fetch(`/admin/course/${id}`, {
        method: 'GET'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro ao obter informações do curso');
        }
        return response.json();
    })
    .then(course => {
        document.getElementById('editCourseId').value = course.id;
        document.getElementById('editCourseName').value = course.name;
        document.getElementById('editCourseDescription').value = course.description;
        
        // Atualizar a pré-visualização da imagem, se houver
        const imagePreview = document.getElementById('editImagePreview');
        if (course.image_url) {
            imagePreview.innerHTML = `<img src="${course.image_url}" alt="Pré-visualização da imagem">`;
            imagePreview.style.display = 'block';
        } else {
            imagePreview.innerHTML = '';
            imagePreview.style.display = 'none';
        }
        
        // Abrir o modal
        document.getElementById('editCourseModal').style.display = 'block';
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao carregar informações do curso');
    });
}

document.getElementById('editCourseForm').onsubmit = function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const courseId = document.getElementById('editCourseId').value;

    const submitButton = document.getElementById('updateCourseBtn');
    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.spinner');

    submitButton.disabled = true;
    buttonText.style.display = 'none';
    spinner.style.display = 'inline-block';

    fetch(`/admin/course/${courseId}`, {
        method: 'PUT',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('editCourseModal').style.display = 'none';
            fetchCourses();
        } else {
            alert('Erro ao atualizar o curso');
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao atualizar o curso');
    })
    .finally(() => {
        submitButton.disabled = false;
        buttonText.style.display = 'inline-block';
        spinner.style.display = 'none';
    });
};

// Delete course
function deleteCourse(id) {
    if (confirm('Tem certeza que deseja excluir este curso?')) {
        fetch(`/admin/course/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchCourses();
                } else {
                    alert('Erro ao excluir o curso');
                }
            });
    }
}

// Edit course
function editCourse(id) {
    window.location.href = `/admin/course/${id}/modification`;
}

// Update totals
function updateTotals(courses, students) {
    if (courses) {
        document.getElementById('totalCourses').textContent = courses.length;
    }
    if (students) {
        document.getElementById('totalStudents').textContent = students;
    }
}

// Show students - Redirect to students panel page
function showStudents() {
    window.location.href = '/admin/students-panel';
}

function fetchTotalStudents() {
    fetch('/admin/total-students')
        .then(response => response.json())
        .then(data => {
            updateTotals(null, data.total);
        });
}

function fetchTotalLessons() {
    fetch('/admin/total-lessons')
        .then(response => response.json())
        .then(data => {
            document.getElementById('totalLessons').textContent = data.total;
        });
}

// Modal functionality
const newCourseModal = document.getElementById('newCourseModal');
const closeBtns = document.getElementsByClassName('close');
const newCourseBtn = document.getElementById('newCourseBtn');

newCourseBtn.onclick = () => newCourseModal.style.display = 'block';

for (let closeBtn of closeBtns) {
    closeBtn.onclick = function() {
        newCourseModal.style.display = 'none';
        document.getElementById('editCourseModal').style.display = 'none';
        document.getElementById('webhookModal').style.display = 'none';
    }
}

let currentCourseUuid;

function openWebhookModal(courseUuid) {
    currentCourseUuid = courseUuid;
    document.getElementById('webhookModal').style.display = 'block';
    document.getElementById('webhookLink').style.display = 'none';
    
    // Reset any previously active buttons
    document.querySelectorAll('.platform-button').forEach(btn => btn.classList.remove('active'));
    
    // Reset the copy button text if it was changed before
    const copyButton = document.getElementById('copyWebhookBtn');
    copyButton.innerHTML = '<i data-lucide="copy" class="h-4 w-4 mr-2 inline"></i> Copiar URL';
    
    // Initialize Lucide icons for the button
    lucide.createIcons({
        elements: [copyButton]
    });
    
    // Hide copy feedback if it was visible
    document.getElementById('copyFeedback').classList.remove('show');
}

document.querySelectorAll('.platform-button').forEach(button => {
    button.addEventListener('click', function() {
        const platform = this.dataset.platform;
        const domain = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.hostname;
        const webhookUrl = `https://${domain}/webhook/${platform}/${currentCourseUuid}`;
        
        document.querySelectorAll('.platform-button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        const webhookLinkElement = document.getElementById('webhookLink');
        const webhookUrlElement = document.getElementById('webhookUrl');
        
        // Format the URL nicely with some padding
        webhookUrlElement.textContent = webhookUrl;
        webhookUrlElement.dataset.originalText = webhookUrl;
        
        // Show the webhook link container with a smooth fade-in effect
        webhookLinkElement.style.display = 'block';
        webhookLinkElement.style.opacity = '0';
        setTimeout(() => {
            webhookLinkElement.style.opacity = '1';
            webhookLinkElement.style.transition = 'opacity 0.3s ease';
        }, 10);
        
        // Initialize the link icon
        lucide.createIcons({
            elements: [document.querySelector('.webhook-header')]
        });
    });
});

// Fix the copy functionality
document.getElementById('copyWebhookBtn').addEventListener('click', function() {
    const webhookUrl = document.getElementById('webhookUrl').textContent;
    
    // Create a temporary textarea to copy the text
    const textArea = document.createElement('textarea');
    textArea.value = webhookUrl;
    textArea.style.position = 'fixed';  // Make it invisible
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            // Update the button text to show success feedback
            this.innerHTML = '<i data-lucide="check" class="h-4 w-4 mr-2 inline"></i> URL Copiada com Sucesso!';
            
            // Initialize the check icon
            lucide.createIcons({
                elements: [this]
            });
            
            // Show the copy feedback animation
            const feedback = document.getElementById('copyFeedback');
            feedback.classList.add('show');
            
            // Reset the button and feedback after 2 seconds
            setTimeout(() => {
                this.innerHTML = '<i data-lucide="copy" class="h-4 w-4 mr-2 inline"></i> Copiar URL';
                feedback.classList.remove('show');
                
                // Initialize the copy icon again
                lucide.createIcons({
                    elements: [this]
                });
            }, 2000);
        } else {
            console.error('Failed to copy text');
        }
    } catch (err) {
        console.error('Error copying text: ', err);
    }
    
    document.body.removeChild(textArea);
});

// Remove the click handler from webhookUrl since we're using the dedicated button
document.getElementById('webhookUrl').removeEventListener('click', function() {});

// Adicione este código à sua lógica existente de fechamento de modal
document.querySelector('#webhookModal .close').onclick = function() {
    document.getElementById('webhookModal').style.display = 'none';
};

window.onclick = function(event) {
    if (event.target == document.getElementById('webhookModal')) {
        document.getElementById('webhookModal').style.display = 'none';
    }
    if (event.target == newCourseModal) {
        newCourseModal.style.display = 'none';
    }
    if (event.target == document.getElementById('editCourseModal')) {
        document.getElementById('editCourseModal').style.display = 'none';
    }
}

// Form submissions
document.getElementById('newCourseForm').onsubmit = function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const courseId = this.getAttribute('data-id');
    const url = courseId ? `/admin/course/${courseId}` : '/admin/course';
    const method = courseId ? 'PUT' : 'POST';

    const submitButton = document.getElementById('createCourseBtn');
    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.spinner');

    submitButton.disabled = true;
    buttonText.style.display = 'none';
    spinner.style.display = 'inline-block';

    fetch(url, {
        method: method,
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            this.reset();
            document.getElementById('imagePreview').innerHTML = '';
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('newCourseModal').style.display = 'none';
            fetchCourses(); // Recarrega a lista de cursos
        } else {
            alert('Erro ao ' + (courseId ? 'atualizar' : 'criar') + ' o curso');
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao ' + (courseId ? 'atualizar' : 'criar') + ' o curso');
    })
    .finally(() => {
        submitButton.disabled = false;
        buttonText.style.display = 'inline-block';
        spinner.style.display = 'none';
        // Resetar o formulário para o estado de criação
        this.removeAttribute('data-id');
        document.getElementById('createCourseBtn').innerHTML = `
            <span class="button-text">Criar Curso</span>
            <span class="spinner" style="display: none;">
                <i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i>
            </span>
        `;
    });
};

document.querySelector('#newCourseModal .close').addEventListener('click', function() {
    document.getElementById('newCourseModal').style.display = 'none';
    document.getElementById('newCourseForm').reset();
    document.getElementById('newCourseForm').removeAttribute('data-id');
    document.getElementById('createCourseBtn').innerHTML = `
        <span class="button-text">Criar Curso</span>
        <span class="spinner" style="display: none;">
            <i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i>
        </span>
    `;
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imagePreview').style.display = 'none';
});

document.querySelector('#editCourseModal .close').addEventListener('click', function() {
    document.getElementById('editCourseModal').style.display = 'none';
});

// Pré-visualizar a imagem no modal de criar curso
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('courseImage');
    const preview = document.getElementById('imagePreview');
    
    if (input) {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.innerHTML = `<img src="${e.target.result}" alt="Pré-visualização da imagem" style="max-width: 100%; border-radius: 8px;">`;
                        preview.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                } else {
                    preview.innerHTML = `<p>Arquivo selecionado: ${file.name}</p>`;
                    preview.style.display = 'block';
                }
            } else {
                preview.style.display = 'none';
            }
        });
    }
});

function createStudentCourseChart() {
    fetch('/admin/course-students-stats')
        .then(response => response.json())
        .then(data => {
            const courseNames = data.map(item => item.course_name);
            const studentCounts = data.map(item => item.student_count);

            const ctx = document.getElementById('studentCourseChart').getContext('2d');
            
            // Gradientes para as barras
            const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
            gradientFill.addColorStop(0, 'rgba(185, 28, 28, 0.8)');
            gradientFill.addColorStop(1, 'rgba(185, 28, 28, 0.3)');
            
            // Cria tooltip personalizado
            const tooltipEl = document.createElement('div');
            tooltipEl.classList.add('chart-tooltip');
            document.querySelector('.chart-container').appendChild(tooltipEl);
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: courseNames,
                    datasets: [{
                        label: 'Número de Alunos',
                        data: studentCounts,
                        backgroundColor: gradientFill,
                        borderColor: '#B91C1C',
                        borderWidth: 2,
                        borderRadius: 8,
                        hoverBackgroundColor: 'rgba(185, 28, 28, 0.9)',
                        barThickness: 24,
                        maxBarThickness: 30
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart',
                        delay: (context) => context.dataIndex * 100,
                        animateScale: true,
                        animateRotate: true
                    },
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 12,
                            cornerRadius: 8,
                            boxPadding: 6,
                            displayColors: false,
                            titleFont: {
                                family: 'Inter',
                                size: 14,
                                weight: 'bold'
                            },
                            bodyFont: {
                                family: 'Inter',
                                size: 13
                            },
                            callbacks: {
                                title: function(context) {
                                    return context[0].label;
                                },
                                label: function(context) {
                                    const count = context.raw;
                                    const label = count === 1 ? 'Aluno' : 'Alunos';
                                    return `${count} ${label}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(156, 163, 175, 0.15)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#4B5563',
                                padding: 10,
                                font: {
                                    family: 'Inter',
                                    size: 11,
                                    weight: '500'
                                },
                                callback: function(value) {
                                    if (Number.isInteger(value)) {
                                        return value;
                                    }
                                    return '';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            ticks: {
                                color: '#4B5563',
                                padding: 8,
                                maxRotation: 45,
                                minRotation: 0,
                                font: {
                                    family: 'Inter',
                                    size: 11,
                                    weight: '500'
                                },
                                callback: function(value, index, values) {
                                    const label = this.getLabelForValue(value);
                                    if (label.length > 15) {
                                        return label.substr(0, 15) + '...';
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        });
}

function importStudents() {
    window.location.href = '/admin/import-students';
}

// Initialize
fetchCourses();
fetchTotalStudents();
fetchTotalLessons();
createStudentCourseChart();