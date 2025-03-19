// my_profile.js - JavaScript para a página de perfil do usuário

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar ícones Lucide
    lucide.createIcons();

    // Configurar menu do usuário
    setupUserMenu();
    
    // Carregar dados do usuário
    loadUserData();
    
    // Configurar evento de formulário para alteração de senha
    setupPasswordForm();
    
    // Configurar visibilidade da senha
    setupPasswordToggle();
});

// Funções principais
function setupUserMenu() {
    const userMenuButton = document.getElementById('userMenuButton');
    const userDropdown = document.getElementById('userDropdown');
    
    userMenuButton.addEventListener('click', function() {
        userDropdown.classList.toggle('hidden');
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(event) {
        if (!userMenuButton.contains(event.target) && !userDropdown.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    });
}

function loadUserData() {
    fetch('/my_profile', {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        // Atualizar o nome da plataforma
        const platformNameElements = document.querySelectorAll('#platformName, #footerPlatformName');
        platformNameElements.forEach(el => {
            if (el) el.textContent = data.platform_name || 'MembriumWL';
        });
        
        // Atualizar o nome do usuário
        const studentNameElements = document.querySelectorAll('#studentName, #studentNameNav');
        studentNameElements.forEach(el => {
            if (el) el.textContent = data.student_name || 'Aluno';
        });
        
        // Preencher os campos do perfil
        document.getElementById('fullName').value = data.student_name || '';
        document.getElementById('email').value = data.student_email || '';
    })
    .catch(error => console.error('Erro ao carregar os dados do usuário:', error));
}

function setupPasswordForm() {
    const passwordForm = document.getElementById('passwordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const successMessage = document.getElementById('successMessage');
    
    passwordForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Resetar mensagens
        newPasswordError.style.display = 'none';
        confirmPasswordError.style.display = 'none';
        successMessage.style.display = 'none';
        
        // Validar campos
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        
        let isValid = true;
        
        if (newPassword === '') {
            newPasswordError.textContent = 'Por favor, informe uma nova senha';
            newPasswordError.style.display = 'block';
            isValid = false;
        } else if (newPassword.length < 6) {
            newPasswordError.textContent = 'A senha deve ter pelo menos 6 caracteres';
            newPasswordError.style.display = 'block';
            isValid = false;
        }
        
        if (confirmPassword === '') {
            confirmPasswordError.textContent = 'Por favor, confirme sua nova senha';
            confirmPasswordError.style.display = 'block';
            isValid = false;
        } else if (newPassword !== confirmPassword) {
            confirmPasswordError.textContent = 'As senhas não coincidem';
            confirmPasswordError.style.display = 'block';
            isValid = false;
        }
        
        if (isValid) {
            // Enviar a nova senha para o servidor
            fetch('/update_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    new_password: newPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Limpar campos
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    
                    // Mostrar mensagem de sucesso
                    successMessage.textContent = data.message || 'Senha alterada com sucesso!';
                    successMessage.style.display = 'block';
                    
                    // Ocultar mensagem após alguns segundos
                    setTimeout(function() {
                        successMessage.style.display = 'none';
                    }, 5000);
                } else {
                    // Mostrar erro
                    newPasswordError.textContent = data.message || 'Erro ao alterar a senha. Tente novamente.';
                    newPasswordError.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Erro ao alterar a senha:', error);
                newPasswordError.textContent = 'Erro de conexão. Tente novamente mais tarde.';
                newPasswordError.style.display = 'block';
            });
        }
    });
}

function setupPasswordToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const showIcon = this.querySelector('.password-icon-show');
            const hideIcon = this.querySelector('.password-icon-hide');
            
            if (input.type === 'password') {
                input.type = 'text';
                showIcon.classList.add('hidden');
                hideIcon.classList.remove('hidden');
            } else {
                input.type = 'password';
                showIcon.classList.remove('hidden');
                hideIcon.classList.add('hidden');
            }
        });
    });
}