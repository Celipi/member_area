// Global variables
let allStudents = [];
let currentPage = 1;
let totalPages = 1;
let currentSearch = '';
let currentCourseFilter = '';
let currentStudentCourses = [];

// Fetch total students for dashboard
function fetchTotalStudents() {
    fetch('/admin/total-students')
        .then(response => response.json())
        .then(data => {
            document.getElementById('totalStudents').textContent = data.total;
        });
}

// Fetch all available courses for filter dropdown
function fetchCoursesForFilter() {
    fetch('/admin/courses')
        .then(response => response.json())
        .then(data => {
            const selectElement = document.getElementById('courseFilter');
            selectElement.innerHTML = '<option value="">Todos os cursos</option>';
            data.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.name;
                selectElement.appendChild(option);
            });
        });
}

// Fetch courses for multi-select in add/edit student forms
function fetchCoursesForSelect() {
    fetch('/admin/courses')
        .then(response => response.json())
        .then(data => {
            const selectElements = document.querySelectorAll('.course-select');
            selectElements.forEach(selectElement => {
                selectElement.innerHTML = '';
                data.forEach(course => {
                    const option = document.createElement('option');
                    option.value = course.id;
                    option.textContent = course.name;
                    selectElement.appendChild(option);
                });
            });
        });
}

// Fetch students with filtering and pagination
function fetchStudents(page = 1, search = '', courseFilter = '') {
    currentPage = page;
    currentSearch = search;
    currentCourseFilter = courseFilter;
    
    const url = `/admin/students?page=${page}&search=${encodeURIComponent(search)}&course=${encodeURIComponent(courseFilter)}`;
    
    // Show loading state
    document.getElementById('studentTableBody').innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="flex justify-center"><i data-lucide="loader" class="animate-spin h-6 w-6 text-primary"></i></div></td></tr>';
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            allStudents = data.students;
            totalPages = data.pages;
            populateStudentTable(allStudents);
            updatePagination();
            
            // Initialize Lucide icons after rendering the table
            lucide.createIcons({
                attrs: {
                    class: ["lucide-icon"]
                }
            });
        });
}

// Update pagination controls
function updatePagination() {
    const paginationElement = document.getElementById('pagination');
    let paginationHTML = '';
    
    if (totalPages > 1) {
        paginationHTML += `<button onclick="fetchStudents(1, currentSearch, currentCourseFilter)" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevrons-left" class="h-4 w-4"></i>
        </button>`;
        
        paginationHTML += `<button onclick="fetchStudents(${currentPage - 1}, currentSearch, currentCourseFilter)" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </button>`;
        
        // Show limited page numbers with current page in the middle when possible
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<button onclick="fetchStudents(${i}, currentSearch, currentCourseFilter)" 
                class="pagination-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
        }
        
        paginationHTML += `<button onclick="fetchStudents(${currentPage + 1}, currentSearch, currentCourseFilter)" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>
            <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>`;
        
        paginationHTML += `<button onclick="fetchStudents(${totalPages}, currentSearch, currentCourseFilter)" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>
            <i data-lucide="chevrons-right" class="h-4 w-4"></i>
        </button>`;
    }
    
    paginationElement.innerHTML = paginationHTML;
    
    // Re-initialize Lucide icons for pagination buttons
    lucide.createIcons({
        attrs: {
            class: ["lucide-icon"]
        }
    });
}

// Populate the student table
function populateStudentTable(students) {
    const tableBody = document.getElementById('studentTableBody');
    tableBody.innerHTML = '';
    
    if (students.length === 0) {
        // No students found
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-500">Nenhum aluno encontrado</td></tr>';
        return;
    }
    
    students.forEach((student, index) => {
        const tr = document.createElement('tr');
        
        // Apply zebra striping
        tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        
        // Name column
        const tdName = document.createElement('td');
        tdName.className = 'py-3 px-4 border-b border-gray-200';
        tdName.innerHTML = `
            <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10">
                    <img class="h-10 w-10 rounded-full border-2 border-gray-200"
                        src="https://cdn-icons-png.flaticon.com/512/11820/11820206.png"
                        alt="${student.name}">
                </div>
                <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">${student.name}</div>
                </div>
            </div>
        `;
        tr.appendChild(tdName);
        
        // Email column
        const tdEmail = document.createElement('td');
        tdEmail.className = 'py-3 px-4 border-b border-gray-200';
        tdEmail.innerHTML = `<div class="text-sm text-gray-900">${student.email}</div>`;
        tr.appendChild(tdEmail);
        
        // Courses column
        const tdCourses = document.createElement('td');
        tdCourses.className = 'py-3 px-4 border-b border-gray-200';
        if (student.courses && student.courses.length > 0) {
            const coursesText = student.courses.map(c => c.name).join(', ');
            tdCourses.innerHTML = `<div class="text-sm text-gray-900">${coursesText}</div>`;
        } else {
            tdCourses.innerHTML = '<div class="text-sm text-gray-500">Nenhum curso</div>';
        }
        tr.appendChild(tdCourses);
        
        // Status column
        const tdStatus = document.createElement('td');
        tdStatus.className = 'py-3 px-4 border-b border-gray-200';
        tdStatus.innerHTML = `
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                Ativo
            </span>
        `;
        tr.appendChild(tdStatus);
        
        // Actions column
        const tdActions = document.createElement('td');
        tdActions.className = 'py-3 px-4 border-b border-gray-200 text-right';
        tdActions.innerHTML = `
            <div class="flex space-x-2 justify-end">
                <button onclick="editStudent(${student.id})" class="p-1.5 bg-blue-100 rounded-md hover:bg-blue-200 transition-all" title="Editar aluno">
                    <i data-lucide="pencil" class="h-4 w-4 text-blue-600"></i>
                </button>
                <button onclick="manageCourses(${student.id}, '${student.name}')" class="p-1.5 bg-green-100 rounded-md hover:bg-green-200 transition-all" title="Gerenciar cursos">
                    <i data-lucide="book-open" class="h-4 w-4 text-green-600"></i>
                </button>
                <button onclick="copyAccessLink('${student.uuid}')" class="p-1.5 bg-purple-100 rounded-md hover:bg-purple-200 transition-all" title="Copiar link de acesso rápido">
                    <i data-lucide="link" class="h-4 w-4 text-purple-600"></i>
                </button>
                <button onclick="deleteStudent(${student.id})" class="p-1.5 bg-red-100 rounded-md hover:bg-red-200 transition-all" title="Excluir aluno">
                    <i data-lucide="trash-2" class="h-4 w-4 text-red-600"></i>
                </button>
            </div>
        `;
        tr.appendChild(tdActions);
        
        tableBody.appendChild(tr);
    });
    
    // Re-initialize Lucide icons for action buttons
    lucide.createIcons({
        attrs: {
            class: ["lucide-icon"]
        }
    });
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value;
    const courseFilter = document.getElementById('courseFilter').value;
    fetchStudents(1, searchTerm, courseFilter);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('courseFilter').value = '';
    fetchStudents(1, '', '');
}

// Add new student
function addNewStudent() {
    document.getElementById('newStudentForm').reset();
    document.getElementById('newStudentModal').style.display = 'block';
    fetchCoursesForSelect();
}

// Edit student
function editStudent(id) {
    fetch(`/admin/student/${id}`)
        .then(response => response.json())
        .then(student => {
            document.getElementById('editStudentId').value = student.id;
            document.getElementById('editStudentEmail').value = student.email;
            document.getElementById('editStudentName').value = student.name;
            document.getElementById('editStudentPassword').value = '';
            // Removida a chamada para buscar cursos
            document.getElementById('editStudentModal').style.display = 'block';
        });
}

// Manage courses for a student
function manageCourses(id, name) {
    currentStudentCourses = [];
    document.getElementById('manageCourseStudentId').value = id;
    document.getElementById('studentCoursesName').textContent = `Aluno: ${name}`;
    document.getElementById('currentCoursesList').innerHTML = '<p class="text-gray-500 text-sm">Carregando cursos...</p>';
    
    // Fetch student details to get courses
    fetch(`/admin/student/${id}`)
        .then(response => response.json())
        .then(student => {
            // Fetch all courses for the dropdown
            fetch('/admin/courses')
                .then(response => response.json())
                .then(courses => {
                    // Populate the dropdown with all available courses
                    const selectElement = document.getElementById('addCourseSelect');
                    selectElement.innerHTML = '';
                    
                    courses.forEach(course => {
                        const option = document.createElement('option');
                        option.value = course.id;
                        option.textContent = course.name;
                        selectElement.appendChild(option);
                    });
                    
                    // Get student's current courses
                    if (student.courses && Array.isArray(student.courses)) {
                        currentStudentCourses = student.courses;
                        
                        // Get course details for each ID
                        const coursesListElement = document.getElementById('currentCoursesList');
                        
                        if (currentStudentCourses.length > 0) {
                            // Find the course details from all courses by matching ID
                            const studentCoursesDetails = courses.filter(course => 
                                currentStudentCourses.includes(course.id)
                            );
                            
                            if (studentCoursesDetails.length > 0) {
                                coursesListElement.innerHTML = '';
                                studentCoursesDetails.forEach(course => {
                                    const courseItem = document.createElement('div');
                                    courseItem.className = 'py-2 px-3 mb-1 bg-gray-50 rounded flex items-center justify-between';
                                    courseItem.innerHTML = `
                                        <span class="text-sm">${course.name}</span>
                                        <button type="button" onclick="removeSpecificCourse(${student.id}, ${course.id})" 
                                            class="text-red-500 hover:text-red-700">
                                            <i data-lucide="x" class="h-4 w-4"></i>
                                        </button>
                                    `;
                                    coursesListElement.appendChild(courseItem);
                                });
                                
                                // Re-initialize Lucide icons for remove buttons
                                lucide.createIcons({
                                    attrs: {
                                        class: ["lucide-icon"]
                                    }
                                });
                            } else {
                                coursesListElement.innerHTML = '<p class="text-gray-500 text-sm">Nenhum curso encontrado para este aluno</p>';
                            }
                        } else {
                            coursesListElement.innerHTML = '<p class="text-gray-500 text-sm">Este aluno não está inscrito em nenhum curso</p>';
                        }
                    } else {
                        document.getElementById('currentCoursesList').innerHTML = 
                            '<p class="text-gray-500 text-sm">Nenhum curso encontrado para este aluno</p>';
                    }
                });
        });
    
    // Show the modal
    document.getElementById('manageCoursesModal').style.display = 'block';
}

// Add course to student
function addCourseToStudent() {
    const studentId = document.getElementById('manageCourseStudentId').value;
    const courseId = document.getElementById('addCourseSelect').value;
    
    if (!studentId || !courseId) {
        alert('Por favor, selecione um curso para adicionar');
        return;
    }
    
    const formData = new FormData();
    formData.append('action', 'include');
    formData.append('course', courseId);
    
    fetch(`/admin/student/${studentId}`, {
        method: 'PUT',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Refresh the student's courses
            manageCourses(studentId, document.getElementById('studentCoursesName').textContent.replace('Aluno: ', ''));
            
            // Refresh the main table
            fetchStudents(currentPage, currentSearch, currentCourseFilter);
        } else {
            alert('Erro ao adicionar curso: ' + (data.message || 'Erro desconhecido'));
        }
    })
    .catch(error => {
        console.error('Error adding course:', error);
        alert('Ocorreu um erro ao adicionar o curso.');
    });
}

// Remove specific course from student
function removeSpecificCourse(studentId, courseId) {
    if (confirm('Tem certeza que deseja remover este curso do aluno?')) {
        const formData = new FormData();
        formData.append('action', 'remove');
        formData.append('course', courseId);
        
        fetch(`/admin/student/${studentId}`, {
            method: 'PUT',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Refresh the student's courses
                manageCourses(studentId, document.getElementById('studentCoursesName').textContent.replace('Aluno: ', ''));
                
                // Refresh the main table
                fetchStudents(currentPage, currentSearch, currentCourseFilter);
            } else {
                alert('Erro ao remover curso: ' + (data.message || 'Erro desconhecido'));
            }
        })
        .catch(error => {
            console.error('Error removing course:', error);
            alert('Ocorreu um erro ao remover o curso.');
        });
    }
}

// Remove course from student (via select)
function removeCourseFromStudent() {
    const studentId = document.getElementById('manageCourseStudentId').value;
    const courseId = document.getElementById('addCourseSelect').value;
    
    if (!studentId || !courseId) {
        alert('Por favor, selecione um curso para remover');
        return;
    }
    
    if (confirm('Tem certeza que deseja remover este curso do aluno?')) {
        removeSpecificCourse(studentId, courseId);
    }
}

// Delete student
function deleteStudent(id) {
    if (confirm('Tem certeza que deseja excluir este aluno?')) {
        fetch(`/admin/student/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    fetchStudents(currentPage, currentSearch, currentCourseFilter);
                    // Update total count
                    fetchTotalStudents();
                } else {
                    alert('Erro ao excluir o aluno: ' + (data.message || 'Ocorreu um erro'));
                }
            })
            .catch(error => {
                console.error('Error deleting student:', error);
                alert('Ocorreu um erro ao excluir o aluno.');
            });
    }
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', function() {
    // Handle new student form submission
    if (document.getElementById('newStudentForm')) {
        document.getElementById('newStudentForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            
            const submitButton = document.querySelector('#newStudentForm button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<i data-lucide="loader" class="h-4 w-4 animate-spin mr-2"></i> Adicionando...';
            
            fetch('/admin/student', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('newStudentModal').style.display = 'none';
                    fetchStudents(1, currentSearch, currentCourseFilter);
                    fetchTotalStudents();
                } else {
                    alert('Erro ao adicionar o aluno: ' + (data.message || 'Ocorreu um erro'));
                }
            })
            .catch(error => {
                console.error('Error adding student:', error);
                alert('Ocorreu um erro ao adicionar o aluno.');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Adicionar Aluno';
            });
        });
    }

    // Handle edit student form submission
    if (document.getElementById('editStudentForm')) {
        document.getElementById('editStudentForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const studentId = document.getElementById('editStudentId').value;
            
            // Add action parameter
            formData.append('action', 'update');
            
            const submitButton = document.querySelector('#editStudentForm button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<i data-lucide="loader" class="h-4 w-4 animate-spin mr-2"></i> Salvando...';
            
            fetch(`/admin/student/${studentId}`, {
                method: 'PUT',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('editStudentModal').style.display = 'none';
                    fetchStudents(currentPage, currentSearch, currentCourseFilter);
                } else {
                    alert('Erro ao atualizar o aluno: ' + (data.message || 'Ocorreu um erro'));
                }
            })
            .catch(error => {
                console.error('Error updating student:', error);
                alert('Ocorreu um erro ao atualizar o aluno.');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Salvar Alterações';
            });
        });
    }

    // Handle search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applyFilters();
            }, 300); // Debounce search
        });
    }

    // Handle course filter change
    const courseFilter = document.getElementById('courseFilter');
    if (courseFilter) {
        courseFilter.addEventListener('change', function() {
            applyFilters();
        });
    }

    // Initialize modals
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close');
    
    // Close modal when clicking on close button
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Initialize the page
    fetchTotalStudents();
    fetchCoursesForFilter();
    fetchStudents();
});

// Navigation
function goBack() {
    window.location.href = '/admin';
}

// Import students
function importStudents() {
    window.location.href = '/admin/import-students';
}

function copyAccessLink(uuid) {
    const url = `${window.location.origin}/access/${uuid}`;
    navigator.clipboard.writeText(url).then(() => {
        // Mostrar feedback visual
        const tooltip = document.createElement('div');
        tooltip.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg';
        tooltip.textContent = 'Link copiado!';
        document.body.appendChild(tooltip);
        
        // Remover o tooltip após 2 segundos
        setTimeout(() => {
            tooltip.remove();
        }, 2000);
    }).catch(err => {
        alert('Erro ao copiar link: ' + err);
    });
}