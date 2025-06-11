$(document).ready(function() {
    const API_BASE_URL = 'http://127.0.0.1:8000';
    const LOGIN_ENDPOINT = `${API_BASE_URL}/api/login_check`;
    const PROJECTS_ENDPOINT = `${API_BASE_URL}/api/projects`;
    const TASKS_ENDPOINT = `${API_BASE_URL}/api/tasks`;
    const ADD_HOURS_ENDPOINT = `${API_BASE_URL}/api/projects/hours`;

    const $loginSection = $('#loginSection');
    const $mainSection = $('#mainSection');
    const $loginForm = $('#loginForm');
    const $usernameInput = $('#username');
    const $passwordInput = $('#password');
    const $loginError = $('#loginError');
    const $logoutButton = $('#logoutButton');
    const $projectSelect = $('#projectSelect');
    const $taskSelection = $('#taskSelection');
    const $taskSearch = $('#taskSearch');
    const $taskListContainer = $('#taskListContainer');
    const $taskList = $('#taskList');
    const $taskLoadingIndicator = $('#taskLoadingIndicator');
    const $hoursSelect = $('#hoursSelect');
    const $minutesSelect = $('#minutesSelect');
    const $commentInput = $('#comment');
    const $addHoursForm = $('#addHoursForm');
    const $hoursMessage = $('#hoursMessage');
    const $addHoursButton = $('#addHoursButton');
    const $loadingIndicator = $('#loadingIndicator');
    const $loggedInUserSpan = $('#loggedInUser');

    let currentJwtToken = null;
    let currentUserName = null;
    let availableTasks = [];
    let selectedTask = null;

    function showLoading(isLoading) {
        $loadingIndicator.toggle(isLoading);
    }

    function apiRequest(method, url, data) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${currentJwtToken}`
        };

        return $.ajax({
            method: method,
            url: url,
            headers: headers,
            data: data ? JSON.stringify(data) : null,
            dataType: 'json'
        });
    }

    function showMessage(element, text, isSuccess) {
        element.text(text)
            .removeClass('success-message error-message')
            .addClass(isSuccess ? 'success-message' : 'error-message');
    }

    function showLoginView() {
        $loginSection.show();
        $mainSection.hide();
        $loginError.text('');
        $usernameInput.val('');
        $passwordInput.val('');
        currentJwtToken = null;
        currentUserName = null;
    }

    function showMainView() {
        $loginSection.hide();
        $mainSection.show();
        $hoursMessage.text('');
        $loggedInUserSpan.text(currentUserName);
        fetchProjects();
        populateTimeSelectors();
    }

    $loginForm.on('submit', function (e) {
        e.preventDefault();
        const username = $usernameInput.val();
        const password = $passwordInput.val();
        $loginError.text('');
        showLoading(true);

        $.ajax({
            method: 'POST',
            url: LOGIN_ENDPOINT,
            contentType: 'application/json',
            data: JSON.stringify({ username: username, password: password })
        }).done(function (response) {
            if (response.token) {
                currentJwtToken = response.token;
                currentUserName = username;
                chrome.storage.local.set({ jwtToken: currentJwtToken, username: username }, function () {
                    if (chrome.runtime.lastError) {
                        showMessage($loginError, 'Storage error: ' + chrome.runtime.lastError.message, false);
                        return;
                    }
                    showMainView();
                });
            } else {
                showMessage($loginError, 'Login failed: No token received.', false);
            }
        }).fail(function() {
            showMessage($loginError, 'Login failed. Please check your credentials.', false);
        }).always(function () {
            showLoading(false);
        });
    });

    $logoutButton.on('click', function () {
        chrome.storage.local.remove(['jwtToken', 'username'], function () {
            showLoginView();
        });
    });

    function fetchProjects() {
        if (!currentJwtToken) return;
        showLoading(true);
        $projectSelect.empty().append('<option value="">Loading projects...</option>').prop('disabled', true);

        const projectsUrl = `${PROJECTS_ENDPOINT}?username=${currentUserName}`;

        apiRequest('GET', projectsUrl)
            .done(function (projects) {
                $projectSelect.empty().prop('disabled', false);
                if (projects && projects.length > 0) {
                    $projectSelect.append('<option value="" selected disabled>Select a project</option>');
                    projects.forEach(function (project) {
                        $projectSelect.append(`<option value="${project.id}">${project.name}</option>`);
                    });
                } else {
                    $projectSelect.append('<option value="">No projects found</option>');
                }
            })
            .fail(function (jqXHR) {
                const errorMsg = `Error: ${jqXHR.status}. Failed to load projects.`;
                $projectSelect.empty().append(`<option value="">${errorMsg}</option>`).prop('disabled', true);
                if (jqXHR.status === 401) {
                    showMessage($hoursMessage, 'Session expired. Please log out and log in again.', false);
                }
            })
            .always(function () {
                showLoading(false);
            });
    }

    function fetchTasks(projectId) {
        if (!currentJwtToken || !projectId) return;

        $taskLoadingIndicator.show();
        $taskSearch.prop('disabled', true).val('');
        availableTasks = [];
        selectedTask = null;

        const tasksUrl = `${TASKS_ENDPOINT}?username=${currentUserName}&projectId=${projectId}`;

        apiRequest('GET', tasksUrl)
            .done(function (tasks) {
                availableTasks = tasks || [];
            })
            .fail(function (jqXHR) {
                const errorMsg = `Error fetching tasks: ${jqXHR.status}.`;
                showMessage($hoursMessage, errorMsg, false);
            })
            .always(function () {
                $taskLoadingIndicator.hide();
                $taskSearch.prop('disabled', false);
            });
    }

    function renderTaskList() {
        const searchTerm = $taskSearch.val().toLowerCase();
        $taskList.empty();

        const filteredTasks = availableTasks.filter(task =>
            task.name.toLowerCase().includes(searchTerm)
        );

        if (filteredTasks.length > 0) {
            filteredTasks.forEach(task => {
                const $item = $(`<div class="task-item" data-id="${task.id}">${task.name}</div>`);
                $taskList.append($item);
            });
        }

        if (searchTerm) {
            const $createItem = $(`<div class="task-item create-new" data-id="new_task">Create new task: "${searchTerm}"</div>`);
            $taskList.append($createItem);
        }

        $taskListContainer.show();
    }

    $projectSelect.on('change', function () {
        const projectId = $(this).val();
        if (projectId) {
            $taskSelection.show();
            fetchTasks(projectId);
        } else {
            $taskSelection.hide();
        }
    });

    $taskSearch.on('focus', function() {
        renderTaskList();
    });

    $taskSearch.on('input', function() {
        selectedTask = null;
        renderTaskList();
    });

    $taskSearch.on('blur', function() {
        setTimeout(() => {
            $taskListContainer.hide();
        }, 200);
    });

    $taskList.on('mousedown', '.task-item', function() {
        const id = $(this).data('id');
        const name = id === 'new_task' ? $taskSearch.val() : $(this).text();

        selectedTask = {
            id: id === 'new_task' ? null : id,
            name: name
        };

        $taskSearch.val(name);
        $taskListContainer.hide();
    });


    function populateTimeSelectors() {
        $hoursSelect.empty().append('<option value="" selected disabled>Hours</option>');
        for (let i = 1; i <= 23; i++) {
            $hoursSelect.append(`<option value="${i}">${i}h</option>`);
        }

        $minutesSelect.empty().append('<option value="" selected disabled>Minutes</option>');
        for (let i = 0; i < 60; i += 10) {
            $minutesSelect.append(`<option value="${i}">${i}m</option>`);
        }
    }

    $addHoursForm.on('submit', function (e) {
        e.preventDefault();
        $hoursMessage.text('');

        const projectId = $projectSelect.val();
        const hours = parseInt($hoursSelect.val()) || 0;
        const minutes = parseInt($minutesSelect.val()) || 0;
        const comment = $commentInput.val();
        const taskNameFromInput = $taskSearch.val().trim();

        if (!projectId) {
            showMessage($hoursMessage, 'Please select a project.', false);
            return;
        }
        if (!taskNameFromInput) {
            showMessage($hoursMessage, 'Please select or create a task.', false);
            return;
        }
        if (hours === 0 && minutes === 0) {
            showMessage($hoursMessage, 'Please select a time duration.', false);
            return;
        }

        let taskId;
        if (selectedTask && selectedTask.name === taskNameFromInput) {
            taskId = selectedTask.id || selectedTask.name;
        } else {
            taskId = taskNameFromInput;
        }

        const totalHours = hours + (minutes / 60);
        const postData = {
            username: currentUserName,
            projectId: projectId,
            taskId: taskId,
            hours: totalHours,
            comment: comment
        };

        showLoading(true);
        $addHoursButton.prop('disabled', true);

        apiRequest('POST', ADD_HOURS_ENDPOINT, postData)
            .done(function (response) {
                showMessage($hoursMessage, response.message || 'Hours added successfully!', true);
                $projectSelect.val('');
                $taskSelection.hide();
                $taskSearch.val('');
                $hoursSelect.val('');
                $minutesSelect.val('');
                $commentInput.val('');
                selectedTask = null;
                availableTasks = [];
            })
            .fail(function (jqXHR) {
                const errorMsg = jqXHR.responseJSON?.message || `Error: ${jqXHR.status}. Failed to add hours.`;
                showMessage($hoursMessage, errorMsg, false);
                if (jqXHR.status === 401) {
                    showMessage($hoursMessage, 'Session expired. Please log out and log in again.', false);
                }
            })
            .always(function () {
                showLoading(false);
                $addHoursButton.prop('disabled', false);
            });
    });

    chrome.storage.local.get(['jwtToken', 'username'], function (result) {
        if (result.jwtToken && result.username) {
            currentJwtToken = result.jwtToken;
            currentUserName = result.username;
            showMainView();
        } else {
            showLoginView();
        }
    });
});