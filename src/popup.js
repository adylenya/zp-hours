$(document).ready(function() {
    const API_BASE_URL = 'https://demo-zp.zimalab.com';
    const LOGIN_ENDPOINT = `${API_BASE_URL}/api/login_check`;
    const REFRESH_ENDPOINT = `${API_BASE_URL}/api/token/refresh`;
    const PROJECTS_ENDPOINT = `${API_BASE_URL}/api/projects`;
    const TASKS_ENDPOINT = `${API_BASE_URL}/api/tasks`;
    const ADD_HOURS_ENDPOINT = `${API_BASE_URL}/api/projects/hours`;
    const RECENT_ITEMS_ENDPOINT = `${API_BASE_URL}/api/recent-items`;

    const $loginSection = $('#loginSection');
    const $mainSection = $('#mainSection');
    const $loginForm = $('#loginForm');
    const $usernameInput = $('#username');
    const $passwordInput = $('#password');
    const $loginError = $('#loginError');
    const $logoutButton = $('#logoutButton');
    const $projectSelect = $('#projectSelect');
    const $projectSuggestions = $('#projectSuggestions');
    const $taskSelection = $('#taskSelection');
    const $taskSearch = $('#taskSearch');
    const $taskSuggestions = $('#taskSuggestions');
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
    const $totalHoursTodayDiv = $('#totalHoursToday');

    const currentDate = new Date();
    const day = currentDate.getDate();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const totalHoursLink = API_BASE_URL + '/report-projects/' + year + '/' + month + '/' + day;

    $totalHoursTodayDiv.attr('href', totalHoursLink);

    $totalHoursTodayDiv.on('click', function(e) {
        e.preventDefault();
        chrome.tabs.create({ url: totalHoursLink }, function(tab) {});
    });

    let currentJwtToken = null;
    let currentRefreshToken = null;
    let currentUserName = null;
    let availableTasks = [];
    let selectedTask = null;

    let refreshAccessTokenPromise = null;

    function showLoading(isLoading) {
        $loadingIndicator.toggle(isLoading);
    }

    function apiRequest(method, url, data, isRetry = false) { // Renamed retried to isRetry for clarity
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
        }).catch(function (jqXHR) {
            if (jqXHR.status === 401 && !isRetry) {
                console.log(`401 encountered for ${url}. Attempting token refresh...`);
                return refreshAccessToken().then(function (success) {
                    if (success) {
                        console.log(`Token refreshed successfully. Retrying original request to ${url}...`);
                        return apiRequest(method, url, data, true);
                    } else {
                        console.error('Token refresh failed. Propagating original request error.');
                        return Promise.reject(jqXHR);
                    }
                });
            }
            return Promise.reject(jqXHR);
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
        fetchRecentProjects();
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
            if (response.access_token && response.refresh_token) {
                currentJwtToken = response.access_token;
                currentRefreshToken = response.refresh_token;
                console.log(response.refresh_token);
                currentUserName = username;
                chrome.storage.local.set({
                    jwtToken: currentJwtToken,
                    refreshToken: currentRefreshToken,
                    username: username
                }, function () {
                    if (chrome.runtime.lastError) {
                        showMessage($loginError, 'Storage error: ' + chrome.runtime.lastError.message, false);
                        return;
                    }
                    showMainView();
                });
            } else {
                showMessage($loginError, 'Login failed: Missing tokens in response.', false);
            }
        }).fail(function() {
            showMessage($loginError, 'Login failed. Please check your credentials.', false);
        }).always(function () {
            showLoading(false);
        });
    });

    $logoutButton.on('click', function () {
        chrome.storage.local.remove(['jwtToken', 'refreshToken', 'username'], function () {
            currentRefreshToken = null;
            showLoginView();
        });
    });

    function refreshAccessToken() {
        if (!currentRefreshToken) {
            console.log('No refresh token available. Cannot refresh.');
            refreshAccessTokenPromise = null;
            return Promise.resolve(false);
        }

        if (refreshAccessTokenPromise) {
            return refreshAccessTokenPromise;
        }

        showLoading(true);

        refreshAccessTokenPromise = new Promise((resolve) => {
            $.ajax({
                method: 'POST',
                url: REFRESH_ENDPOINT,
                contentType: 'application/json',
                data: JSON.stringify({ refresh_token: currentRefreshToken })
            })
                .done(function (response) {
                    if (response.access_token && response.refresh_token) {
                        currentJwtToken = response.access_token;
                        currentRefreshToken = response.refresh_token;

                        chrome.storage.local.set({
                            jwtToken: currentJwtToken,
                            refreshToken: currentRefreshToken
                        }, function () {
                            if (chrome.runtime.lastError) {
                                console.error('Storage error after token refresh:', chrome.runtime.lastError.message);
                            }
                            console.log('Access and refresh tokens refreshed and stored successfully.');
                            resolve(true);
                        });
                    } else {
                        console.error('Refresh failed: Missing new tokens in backend response.');
                        chrome.storage.local.remove(['jwtToken', 'refreshToken', 'username'], function () {
                            currentJwtToken = null;
                            currentRefreshToken = null;
                            currentUserName = null;
                            showLoginView();
                            showMessage($loginError, 'Your session has expired or could not be renewed. Please log in again.', false);
                        });
                        resolve(false);
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    console.error('Refresh token request failed:', jqXHR.status, textStatus, errorThrown);
                    chrome.storage.local.remove(['jwtToken', 'refreshToken', 'username'], function () {
                        currentJwtToken = null;
                        currentRefreshToken = null;
                        currentUserName = null;
                        showLoginView();
                        showMessage($loginError, 'Your session has expired. Please log in again.', false);
                    });
                    resolve(false);
                })
                .always(function () {
                    showLoading(false);
                    refreshAccessTokenPromise = null;
                });
        });

        return refreshAccessTokenPromise;
    }

    function fetchProjects() {
        if (!currentJwtToken) return;
        showLoading(true);
        $projectSelect.empty().append('<option value="">Loading projects...</option>').prop('disabled', true);
        $projectSuggestions.show();

        const projectsUrl = `${PROJECTS_ENDPOINT}?username=${currentUserName}`;

        apiRequest('GET', projectsUrl)
            .done(function (response) {
                $projectSelect.empty().prop('disabled', false);
                const projects = response.projects;
                const totalHoursToday = response.totalHoursToday;
                $loggedInUserSpan.text(response.userFullName);

                if (projects && projects.length > 0) {
                    $projectSelect.append('<option value="" selected disabled>Select a project</option>');
                    projects.forEach(function (project) {
                        $projectSelect.append(`<option value="${project.id}">${project.name}</option>`);
                    });
                } else {
                    $projectSelect.append('<option value="">No projects found</option>');
                }
                displayTotalHoursToday(totalHoursToday);
            })
            .fail(function (jqXHR) {
                const errorMsg = `Error: ${jqXHR.status}. Failed to load projects.`;
                $projectSelect.empty().append(`<option value="">${errorMsg}</option>`).prop('disabled', true);
                showMessage($hoursMessage, 'Session error. Please log out and log in again.', false);
            })
            .always(function () {
                showLoading(false);
            });
    }

    function displayTotalHoursToday(hours) {
        const h = Math.floor(hours / 60);
        const m = hours % 60;
        $totalHoursTodayDiv.text(`Hours today: ${h}:${m < 10 ? '0' : ''}${m}`);
    }

    function fetchTasks(projectId) {
        if (!currentJwtToken || !projectId) return;

        $taskLoadingIndicator.show();
        $taskSearch.prop('disabled', true).val('');
        availableTasks = [];
        selectedTask = null;
        $taskSuggestions.show();

        const tasksUrl = `${TASKS_ENDPOINT}?username=${currentUserName}&projectId=${projectId}`;

        apiRequest('GET', tasksUrl)
            .done(function (tasks) { availableTasks = tasks || []; })
            .fail(function (jqXHR) { showMessage($hoursMessage, `Error fetching tasks: ${jqXHR.status}.`, false); })
            .always(function () {
                $taskLoadingIndicator.hide();
                $taskSearch.prop('disabled', false);
            });
    }

    function fetchRecentProjects() {
        if (!currentJwtToken) return;
        const suggestionsUrl = `${RECENT_ITEMS_ENDPOINT}?username=${currentUserName}`; // No projectId
        apiRequest('GET', suggestionsUrl)
            .done(function (response) {
                renderProjectSuggestions(response.recentProjects);
            })
            .fail(function() { console.error("Failed to load recent projects."); });
    }

    function fetchRecentTasks(projectId) {
        if (!currentJwtToken || !projectId) return;
        $taskSuggestions.empty(); // Clear previous suggestions
        const suggestionsUrl = `${RECENT_ITEMS_ENDPOINT}?username=${currentUserName}&projectId=${projectId}`;
        apiRequest('GET', suggestionsUrl)
            .done(function (response) {
                renderTaskSuggestions(response.recentTasks);
            })
            .fail(function() { console.error("Failed to load recent tasks for project " + projectId); });
    }

    function renderProjectSuggestions(projects) {
        $projectSuggestions.empty();
        if (projects && projects.length > 0) {
            projects.forEach(function(project) {
                const $pill = $(`<div class="suggestion-pill" data-id="${project.id}"></div>`).text(project.name);
                $projectSuggestions.append($pill);
            });
            $projectSuggestions.show();
        } else {
            $projectSuggestions.hide();
        }
    }

    function renderTaskSuggestions(tasks) {
        $taskSuggestions.empty();
        if (tasks && tasks.length > 0) {
            tasks.forEach(function(task) {
                const $pill = $(`<div class="suggestion-pill" data-name="${task.name}"></div>`).text(task.name);
                $taskSuggestions.append($pill);
            });
            $taskSuggestions.show();
        } else {
            $taskSuggestions.hide();
        }
    }

    $projectSuggestions.on('click', '.suggestion-pill', function() {
        const projectId = $(this).data('id');
        $projectSelect.val(projectId).trigger('change');
        $projectSuggestions.hide();
    });

    $taskSuggestions.on('click', '.suggestion-pill', function() {
        const taskName = $(this).data('name');
        $taskSearch.val(taskName);
        selectedTask = { id: null, name: taskName };
        $taskSearch.trigger('focus');
        $taskSuggestions.hide();
    });

    $projectSelect.on('change', function () {
        const projectId = $(this).val();
        $taskSuggestions.empty();
        if (projectId) {
            $taskSelection.show();
            fetchTasks(projectId);
            fetchRecentTasks(projectId);
            $projectSuggestions.hide();
        } else {
            $taskSelection.hide();
            $projectSuggestions.show();
        }
    });

    function renderTaskList() {
        const searchTerm = $taskSearch.val().toLowerCase();
        $taskList.empty();

        const filteredTasks = availableTasks.filter(task =>
            (task.id + task.name.toLowerCase()).includes(searchTerm)
        );

        if (filteredTasks.length > 0) {
            filteredTasks.forEach(task => {
                const $item = $(`<div class="task-item" data-id="${task.id}">${task.id} - ${task.name}</div>`);
                $taskList.append($item);
            });
        }

        if (searchTerm) {
            $taskList.append($(`<div class="task-item create-new" data-id="new_task">Create new task: "${searchTerm}"</div>`));
        }
        $taskSuggestions.hide();
        $taskListContainer.show();
    }

    $taskSearch.on('focus', function() {
        if ($taskSearch.val() || availableTasks.length > 0) {
            renderTaskList();
        } else {
            const projectId = $projectSelect.val();
            if (projectId) {
                fetchRecentTasks(projectId);
            }
        }
    });

    $taskSearch.on('input', function() {
        selectedTask = null;
        renderTaskList();
        $taskSuggestions.hide();
    });

    $taskSearch.on('blur', function() {
        setTimeout(() => {
            $taskListContainer.hide();
            if (!selectedTask && !$taskSearch.val()) {
                const projectId = $projectSelect.val();
                if (projectId) {
                    fetchRecentTasks(projectId);
                }
            }
        }, 200);
    });

    $taskList.on('mousedown', '.task-item', function() {
        const id = $(this).data('id');
        const name = id === 'new_task' ? $taskSearch.val() : $(this).text();
        selectedTask = { id: id === 'new_task' ? null : id, name: name };
        $taskSearch.val(name);
        $taskListContainer.hide();
        $taskSuggestions.hide();
    });

    function populateTimeSelectors() {
        $hoursSelect.empty().append('<option value="" selected disabled>Hours</option>');
        for (let i = 0; i <= 23; i++) {
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

        if (!projectId) { showMessage($hoursMessage, 'Please select a project.', false); return; }
        if (!taskNameFromInput) { showMessage($hoursMessage, 'Please select or create a task.', false); return; }
        if (hours === 0 && minutes === 0) { showMessage($hoursMessage, 'Please select a time duration.', false); return; }

        let taskId;
        if (selectedTask && selectedTask.name === taskNameFromInput) {
            taskId = selectedTask.id || selectedTask.name;
        } else {
            taskId = taskNameFromInput;
        }

        const totalHours = hours + (minutes / 60);
        const postData = { username: currentUserName, projectId: projectId, taskId: taskId, hours: totalHours, comment: comment };

        showLoading(true);
        $addHoursButton.prop('disabled', true);

        apiRequest('POST', ADD_HOURS_ENDPOINT, postData)
            .done(function (response) {
                showMessage($hoursMessage, response.message || 'Hours added successfully!', true);
                $projectSelect.val('').trigger('change');
                $taskSelection.hide();
                $taskSearch.val('');
                $hoursSelect.val('');
                $minutesSelect.val('');
                $commentInput.val('');
                selectedTask = null;
                availableTasks = [];
                $projectSuggestions.empty();
                $taskSuggestions.empty();
                fetchRecentProjects();
                $projectSuggestions.show();
            })
            .fail(function (jqXHR) {
                const errorMsg = jqXHR.responseJSON?.message || `Error: ${jqXHR.status}. Failed to add hours.`;
                showMessage($hoursMessage, errorMsg, false);
                showMessage($hoursMessage, 'Session error. Please log out and log in again.', false);
            })
            .always(function () {
                showLoading(false);
                $addHoursButton.prop('disabled', false);
                fetchProjects();
            });
    });

    chrome.storage.local.get(['jwtToken', 'refreshToken', 'username'], function (result) {
        if (result.jwtToken && result.refreshToken && result.username) {
            currentJwtToken = result.jwtToken;
            currentRefreshToken = result.refreshToken;
            currentUserName = result.username;
            showMainView();
        } else {
            showLoginView();
        }
    });
});
