---
---
$(function() {
  deadlineByConf = {};

  {% for conf in site.data.conferences %}
  {% for edition in conf.editions %}
  {% if edition.deadline %}
  // {{ conf.name }} {{ edition.year }}
  {% if edition.deadline[0] == "TBA" %}
  {% assign conf_id = conf.name | append: edition.year | append: '-0' | slugify %}
  $('#{{ conf_id }} .timer').html("TBA");
  $('#{{ conf_id }} .deadline-time').html("TBA");
  deadlineByConf["{{ conf_id }}"] = null;

  {% else %}
  var rawDeadlines = {{ edition.deadline | jsonify }} || [];
  if (rawDeadlines.constructor !== Array) {
    rawDeadlines = [rawDeadlines];
  }
  var parsedDeadlines = [];
  while (rawDeadlines.length > 0) {
    var rawDeadline = rawDeadlines.pop();
    // deal with year template in deadline
    year = {{ edition.year }};
    rawDeadline = rawDeadline.replace('%y', year).replace('%Y', year - 1);
    // adjust date according to deadline timezone
    {% if edition.timezone %}
    var deadline = moment.tz(rawDeadline, "{{ edition.timezone }}");
    {% else %}
    var deadline = moment.tz(rawDeadline, "Etc/GMT+12"); // Anywhere on Earth
    {% endif %}

    // post-process date
    if (deadline.minutes() === 0) {
      deadline.subtract(1, 'seconds');
    }
    if (deadline.minutes() === 59) {
      deadline.seconds(59);
    }
    parsedDeadlines.push(deadline);
  }
  // due to pop before; we need to reverse such that the i index later matches
  // the right parsed deadline
  parsedDeadlines.reverse();

  {% assign range_end = edition.deadline.size | minus: 1 %}
  {% for i in (0..range_end) %}
  {% assign conf_id = conf.name | append: edition.year | append: '-' | append: i | slugify %}
  {% assign gcal_title = conf.name | append: " " | append: edition.year | append: " Deadline" %}
  {% assign gcal_details = "Paper submission deadline for " | append: conf.name | append: " " | append: edition.year %}
  var deadlineId = {{ i }};
  if (deadlineId < parsedDeadlines.length) {
    var confDeadline = parsedDeadlines[deadlineId];

    // render countdown timer
    if (confDeadline) {
      function make_update_countdown_fn(confDeadline, confId) {
        return function(event) {
          var diff = moment() - confDeadline;
          var daysLeft = confDeadline.diff(moment(), 'days');
          var $timer = $(this);
          var $badge = $('#' + confId + ' .d-day-badge');

          if (diff <= 0) {
             $timer.html(event.strftime('%D days %Hh %Mm %Ss'));
          } else {
             $timer.html(confDeadline.fromNow());
          }

          if (daysLeft <= 10 && diff < 0) {
            $timer.addClass('text-danger fw-bold');
          } else {
            $timer.removeClass('text-danger fw-bold');
          }

          if (diff < 0) {
            var badgeText = daysLeft === 0 ? 'Due Today!' : (daysLeft === 1 ? '1 Day Left' : daysLeft + ' Days Left');
            $badge.removeClass('bg-danger bg-warning bg-info bg-orange text-white text-dark');
            if (daysLeft <= 10) {
              $badge.text(badgeText).addClass('bg-danger text-white').show();
            } else if (daysLeft <= 20) {
              $badge.text(badgeText).addClass('bg-orange text-white').show();
            } else if (daysLeft <= 30) {
              $badge.text(badgeText).addClass('bg-warning text-dark').show();
            } else {
              $badge.hide();
            }
          } else {
            $badge.hide();
          }
        }
      }
      $('#{{ conf_id }} .timer').countdown(confDeadline.toDate(), make_update_countdown_fn(confDeadline, '{{ conf_id }}'));
      // check if date has passed, add 'past' class to it
      if (moment() - confDeadline > 0) {
        $('#{{ conf_id }}').addClass('past');
      }
      var $dt = $('#{{ conf_id }} .deadline-time');
      $dt.html(confDeadline.local().format('D MMM YYYY, h:mm:ss a'));
      $dt.css({'cursor': 'pointer', 'text-decoration': 'underline', 'color': '#0d6efd'});
      $dt.attr('title', 'Show in calendar');
      $dt.data('calendar-date', confDeadline.format('YYYY-MM-DD'));
      $dt.on('click', function() {
        var dateStr = $(this).data('calendar-date');
        $('html, body').animate({
          scrollTop: $('.calendar').offset().top - 100
        }, 500);
        currentMonth = moment(dateStr, 'YYYY-MM-DD');
        renderCalendar();
        setTimeout(function() {
          var $targetDay = $('.calendar-day[data-date="' + dateStr + '"]');
          if ($targetDay.length) {
            $targetDay.addClass('border border-3 border-warning');
            setTimeout(function() {
              $targetDay.removeClass('border border-3 border-warning');
            }, 2000);
          }
        }, 100);
      });
      var $calBtn = $('#{{ conf_id }} .add-calendar-btn');
      if ($calBtn.length) {
        var gcalStart = confDeadline.clone().utc().format('YYYYMMDD[T]HHmmss[Z]');
        var gcalEnd = confDeadline.clone().utc().add(30, 'minutes').format('YYYYMMDD[T]HHmmss[Z]');
        var gcalTitle = encodeURIComponent({{ gcal_title | jsonify }});
        var gcalDetails = encodeURIComponent({{ gcal_details | jsonify }});
        var gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + gcalTitle + '&dates=' + gcalStart + '/' + gcalEnd + '&details=' + gcalDetails;
        $calBtn.attr('href', gcalUrl).show();
      }

      deadlineByConf["{{ conf_id }}"] = confDeadline;
    }
  } else {
    // TODO: hide the conf_id ?
  }
  {% endfor %}
  {% endif %}
  {% endif %}
  {% endfor %}
  {% endfor %}

  // Favorite state management
  var favorites = [];
  try {
    favorites = JSON.parse(localStorage.getItem('conf_favorites')) || [];
  } catch (e) {
    favorites = [];
  }

  // Update UI for favorites
  $('.favorite-star').each(function() {
    var confId = $(this).data('conf-id');
    if (favorites.indexOf(confId) !== -1) {
      $(this).addClass('active');
    }
  });

  $('.favorite-star').on('click', function(e) {
    e.preventDefault();
    var confId = $(this).data('conf-id');
    var index = favorites.indexOf(confId);
    
    if (index === -1) {
      // Allow only one favorite
      $('.favorite-star').removeClass('active');
      favorites = [confId];
      $(this).addClass('active');
    } else {
      // Toggle off if clicking the already favorited one
      favorites = [];
      $(this).removeClass('active');
    }
    
    localStorage.setItem('conf_favorites', JSON.stringify(favorites));
    reorderConferences();
    update_conf_list();
  });

  // Reorder list
  function reorderConferences() {
    var today = moment();
    var sortedConfs = $('.conf').detach();
    sortedConfs.sort(function(a, b) {
      var aFav = favorites.indexOf(a.id) !== -1;
      var bFav = favorites.indexOf(b.id) !== -1;
      
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      var aDeadline = deadlineByConf[a.id];
      var bDeadline = deadlineByConf[b.id];
      var aDiff = today.diff(aDeadline);
      var bDiff = today.diff(bDeadline);
      
      if (aDiff < 0 && bDiff > 0) {
        return -1;
      }
      if (aDiff > 0 && bDiff < 0) {
        return 1;
      }
      return bDiff - aDiff;
    });
    $('.conf-container').append(sortedConfs);
  }

  reorderConferences();

  // Filter state management
  var filterState = {
    field: 'ALL',
    topconf: 'ALL',
    bkif: [],
    conftype: 'ALL',
    hidePast: false,
    search: ''
  };

  // Load saved state
  var savedState = store.get('{{ site.domain }}_filter_v3');
  if (savedState) {
    filterState = savedState;
    if (!Array.isArray(filterState.bkif)) {
      filterState.bkif = [];
    }
    if (typeof filterState.search !== 'string') {
      filterState.search = '';
    }
    if (filterState.search) {
      $('#conf-search').val(filterState.search);
    }
    if (filterState.field !== 'ALL') {
      $('#' + filterState.field + '-radio').prop('checked', true);
    } else {
      $('#ALL-radio').prop('checked', true);
    }
    if (filterState.topconf === 'YES') {
      $('#TOP-YES-radio').prop('checked', true);
    } else {
      $('#TOP-ALL-radio').prop('checked', true);
    }
    // Restore BK21-IF checkbox state
    filterState.bkif.forEach(function(bk) {
      $('#' + bk + '-checkbox').prop('checked', true);
    });
    if (filterState.conftype !== 'ALL') {
      $('#' + filterState.conftype + '-radio').prop('checked', true);
    } else {
      $('#TYPE-ALL-radio').prop('checked', true);
    }
    if (filterState.hidePast) {
      $('#HIDE-PAST-checkbox').prop('checked', true);
    }
  }

  function update_conf_list() {
    var visibleCount = 0;
    $('.conf').each(function(i, conf) {
      var $conf = $(conf);
      
      // Always show favorited conference regardless of filters
      if (favorites.indexOf(conf.id) !== -1) {
        $conf.show();
        visibleCount++;
        return true;
      }

      var show = true;

      // 0. Search filter
      if (show && filterState.search) {
        var searchText = $conf.attr('data-search') || '';
        if (searchText.indexOf(filterState.search) === -1) {
          show = false;
        }
      }

      // 1. Field filter (SEC or SE)
      if (filterState.field !== 'ALL') {
        if (!$conf.hasClass(filterState.field)) {
          show = false;
        }
      }

      // 2. Top Conference filter
      if (show && filterState.topconf === 'YES') {
        if (filterState.field === 'SEC') {
          if (!$conf.hasClass('SEC-TOP')) {
            show = false;
          }
        } else if (filterState.field === 'SE') {
          if (!$conf.hasClass('SE-TOP')) {
            show = false;
          }
        } else {
          if (!$conf.hasClass('SEC-TOP') && !$conf.hasClass('SE-TOP')) {
            show = false;
          }
        }
      }

      // 3. BK21-IF filter (show if matches any selected)
      if (show && filterState.bkif.length > 0) {
        var hasBkif = false;
        for (var j = 0; j < filterState.bkif.length; j++) {
          if ($conf.hasClass(filterState.bkif[j])) {
            hasBkif = true;
            break;
          }
        }
        if (!hasBkif) {
          show = false;
        }
      }

      // 4. Type filter (CONF or SHOP)
      if (show && filterState.conftype !== 'ALL') {
        if (!$conf.hasClass(filterState.conftype)) {
          show = false;
        }
      }

      // 5. Hide past deadlines
      if (show && filterState.hidePast) {
        if ($conf.hasClass('past')) {
          show = false;
        }
      }

      if (show) {
        $conf.show();
        visibleCount++;
      } else {
        $conf.hide();
      }
    });
    $('#empty-state').toggle(visibleCount === 0);
  }
  update_conf_list();

  // Search input event
  $('#conf-search').on('input', function() {
    filterState.search = $(this).val().trim().toLowerCase();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // Field radio button event
  $('.field-radio').change(function(e) {
    filterState.field = $(this).val();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // Top Conference radio button event
  $('.top-radio').change(function(e) {
    filterState.topconf = $(this).val();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // BK21-IF checkbox event
  $('.bkif-checkbox').change(function(e) {
    var val = $(this).val();
    var checked = $(this).is(':checked');
    if (checked) {
      if (filterState.bkif.indexOf(val) === -1) {
        filterState.bkif.push(val);
      }
    } else {
      var idx = filterState.bkif.indexOf(val);
      if (idx !== -1) {
        filterState.bkif.splice(idx, 1);
      }
    }
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // Type radio button event
  $('.type-radio').change(function(e) {
    filterState.conftype = $(this).val();
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // Hide past deadlines checkbox event
  $('.hide-past-checkbox').change(function(e) {
    filterState.hidePast = $(this).is(':checked');
    store.set('{{ site.domain }}_filter_v3', filterState);
    update_conf_list();
  });

  // ========== Format Conference Dates in Cards ==========
  $('.conf-date-display').each(function() {
    var $el = $(this);
    var start = moment($el.data('start'));
    var end = moment($el.data('end'));
    if (start.isValid() && end.isValid()) {
      var formatted;
      if (start.year() === end.year() && start.month() === end.month()) {
        formatted = start.format('MMM D') + ' – ' + end.format('D, YYYY');
      } else if (start.year() === end.year()) {
        formatted = start.format('MMM D') + ' – ' + end.format('MMM D, YYYY');
      } else {
        formatted = start.format('MMM D, YYYY') + ' – ' + end.format('MMM D, YYYY');
      }
      $el.html('📅 ' + formatted);
    }
  });

  // ========== Calendar ==========
  var currentMonth = moment();

  // Collect all deadlines with conference info
  var allDeadlines = {};
  for (var confId in deadlineByConf) {
    var deadline = deadlineByConf[confId];
    if (deadline) {
      var dateKey = deadline.format('YYYY-MM-DD');
      if (!allDeadlines[dateKey]) {
        allDeadlines[dateKey] = [];
      }
      // Extract conference name from ID
      var confName = confId.replace(/-\d+$/, '').replace(/-/g, ' ').toUpperCase();
      allDeadlines[dateKey].push({
        id: confId,
        name: confName,
        time: deadline.format('HH:mm')
      });
    }
  }

  // Collect all conference dates (from editions with ISO date ranges)
  var allConferenceDates = {};
  {% for conf in site.data.conferences %}
  {% for edition in conf.editions %}
  {% if edition.date and edition.date != "TBA" %}
  (function() {
    var dateStr = "{{ edition.date }}";
    if (dateStr.indexOf('/') !== -1) {
      var parts = dateStr.split('/');
      var startDate = moment(parts[0]);
      var endDate = moment(parts[1]);
      var current = startDate.clone();
      while (current.isSameOrBefore(endDate)) {
        var dateKey = current.format('YYYY-MM-DD');
        if (!allConferenceDates[dateKey]) {
          allConferenceDates[dateKey] = [];
        }
        allConferenceDates[dateKey].push({
          name: "{{ conf.name }} {{ edition.year }}",
          place: "{{ edition.place }}"
        });
        current.add(1, 'day');
      }
    }
  })();
  {% endif %}
  {% endfor %}
  {% endfor %}

  function renderCalendar() {
    var $container = $('#calendar-days');
    $container.empty();

    // Update title
    $('#calendar-title').text(currentMonth.format('MMMM YYYY'));

    // Get first day of month and total days
    var firstDay = currentMonth.clone().startOf('month');
    var lastDay = currentMonth.clone().endOf('month');
    var startDayOfWeek = firstDay.day();
    var totalDays = lastDay.date();

    // Previous month days
    var prevMonth = currentMonth.clone().subtract(1, 'month');
    var prevMonthDays = prevMonth.daysInMonth();
    for (var i = startDayOfWeek - 1; i >= 0; i--) {
      var day = prevMonthDays - i;
      var $day = $('<div class="calendar-day other-month"></div>').text(day);
      $container.append($day);
    }

    // Current month days
    var todayStr = moment().format('YYYY-MM-DD');
    for (var d = 1; d <= totalDays; d++) {
      var dateStr = currentMonth.format('YYYY-MM') + '-' + String(d).padStart(2, '0');
      var $day = $('<div class="calendar-day"></div>').text(d);
      $day.attr('data-date', dateStr);

      // Today highlight
      if (dateStr === todayStr) {
        $day.addClass('today');
      }

      // Build combined tooltip
      var tooltipParts = [];

      // Conference date highlight (blue)
      if (allConferenceDates[dateStr]) {
        $day.addClass('has-conference');
        allConferenceDates[dateStr].forEach(function(c) {
          tooltipParts.push('📍 ' + c.name + (c.place ? ' @ ' + c.place : ''));
        });
      }

      // Deadline highlight (red) - takes visual priority over conference
      if (allDeadlines[dateStr]) {
        $day.addClass('has-deadline');
        allDeadlines[dateStr].forEach(function(dl) {
          tooltipParts.push('<span class="info-link" data-target="' + dl.id + '" style="color: #8b0029; font-weight: 600; cursor: pointer; text-decoration: underline;">⏰ ' + dl.name + ' (' + dl.time + ')</span>');
        });
      }

      // Set combined tooltip and click handler
      if (tooltipParts.length > 0) {
        $day.data('tooltip', tooltipParts.join('<br>'));
        $day.css('cursor', 'pointer');

        $day.on('mouseenter', function() {
          $('#calendar-info-box').html($(this).data('tooltip')).css('visibility', 'visible');
        });
        
        $day.on('mouseleave', function() {
          $('#calendar-info-box').css('visibility', 'hidden');
        });
      }

      $container.append($day);
    }

    // Delegated click event for links in the info box
    $('#calendar-info-box').off('click', '.info-link').on('click', '.info-link', function() {
      var targetId = $(this).data('target');
      if (targetId) {
        var $target = $('#' + targetId);
        if ($target.length) {
          $('html, body').animate({
            scrollTop: $target.offset().top - 100
          }, 500);
          $target.addClass('border border-3 border-warning');
          setTimeout(function() {
            $target.removeClass('border border-3 border-warning');
          }, 2000);
        }
      }
    });

    // Next month days (fill remaining grid)
    var totalCells = $container.children().length;
    var remaining = 42 - totalCells; // 6 rows x 7 days
    for (var n = 1; n <= remaining; n++) {
      var $day = $('<div class="calendar-day other-month"></div>').text(n);
      $container.append($day);
    }
  }

  // Calendar navigation
  $('#prev-month').on('click', function() {
    currentMonth.subtract(1, 'month');
    renderCalendar();
  });

  $('#next-month').on('click', function() {
    currentMonth.add(1, 'month');
    renderCalendar();
  });

  // Initial render
  renderCalendar();
});
