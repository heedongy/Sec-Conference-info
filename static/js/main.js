---
---
$(function() {
  deadlineByConf = {};

  {% for conf in site.data.conferences %}
  // {{ conf.name }} {{ conf.year }}
  {% if conf.deadline[0] == "TBA" %}
  {% assign conf_id = conf.name | append: conf.year | append: '-0' | slugify %}
  $('#{{ conf_id }} .timer').html("TBA");
  $('#{{ conf_id }} .deadline-time').html("TBA");
  deadlineByConf["{{ conf_id }}"] = null;

  {% else %}
  var rawDeadlines = {{ conf.deadline | jsonify }} || [];
  if (rawDeadlines.constructor !== Array) {
    rawDeadlines = [rawDeadlines];
  }
  var parsedDeadlines = [];
  while (rawDeadlines.length > 0) {
    var rawDeadline = rawDeadlines.pop();
    // deal with year template in deadline
    year = {{ conf.year }};
    rawDeadline = rawDeadline.replace('%y', year).replace('%Y', year - 1);
    // adjust date according to deadline timezone
    {% if conf.timezone %}
    var deadline = moment.tz(rawDeadline, "{{ conf.timezone }}");
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

  {% assign range_end = conf.deadline.size | minus: 1 %}
  {% for i in (0..range_end) %}
  {% assign conf_id = conf.name | append: conf.year | append: '-' | append: i | slugify %}
  var deadlineId = {{ i }};
  if (deadlineId < parsedDeadlines.length) {
    var confDeadline = parsedDeadlines[deadlineId];

    // render countdown timer
    if (confDeadline) {
      function make_update_countdown_fn(confDeadline) {
        return function(event) {
          diff = moment() - confDeadline
          if (diff <= 0) {
             $(this).html(event.strftime('%D days %Hh %Mm %Ss'));
          } else {
            $(this).html(confDeadline.fromNow());
          }
        }
      }
      $('#{{ conf_id }} .timer').countdown(confDeadline.toDate(), make_update_countdown_fn(confDeadline));
      // check if date has passed, add 'past' class to it
      if (moment() - confDeadline > 0) {
        $('#{{ conf_id }}').addClass('past');
      }
      $('#{{ conf_id }} .deadline-time').html(confDeadline.local().format('D MMM YYYY, h:mm:ss a'));
      deadlineByConf["{{ conf_id }}"] = confDeadline;
    }
  } else {
    // TODO: hide the conf_id ?
  }
  {% endfor %}
  {% endif %}
  {% endfor %}

  // Reorder list
  var today = moment();
  var confs = $('.conf').detach();
  confs.sort(function(a, b) {
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
  $('.conf-container').append(confs);

  // Filter state management
  var filterState = {
    field: 'ALL',
    topconf: 'ALL',
    bkif: [],
    conftype: 'ALL'
  };

  // Load saved state
  var savedState = store.get('{{ site.domain }}_filter_v3');
  if (savedState) {
    filterState = savedState;
    if (!Array.isArray(filterState.bkif)) {
      filterState.bkif = [];
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
  }

  function update_conf_list() {
    confs.each(function(i, conf) {
      var $conf = $(conf);
      var show = true;

      // 1. Field filter (SEC or SE)
      if (filterState.field !== 'ALL') {
        if (!$conf.hasClass(filterState.field)) {
          show = false;
        }
      }

      // 2. Top Conference filter
      if (show && filterState.topconf === 'YES') {
        // Check the TOP tag for the selected field
        if (filterState.field === 'SEC') {
          if (!$conf.hasClass('SEC-TOP')) {
            show = false;
          }
        } else if (filterState.field === 'SE') {
          if (!$conf.hasClass('SE-TOP')) {
            show = false;
          }
        } else {
          // If all fields are selected, show if it has SEC-TOP or SE-TOP
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

      if (show) {
        $conf.show();
      } else {
        $conf.hide();
      }
    });
  }
  update_conf_list();

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

      // Deadline highlight
      if (allDeadlines[dateStr]) {
        $day.addClass('has-deadline');
        var deadlineList = allDeadlines[dateStr];
        var tooltipText = deadlineList.map(function(dl) {
          return dl.name + ' (' + dl.time + ')';
        }).join('\n');
        $day.attr('title', tooltipText);

        // Click to scroll to conference
        $day.css('cursor', 'pointer');
        $day.on('click', function() {
          var date = $(this).attr('data-date');
          var deadlines = allDeadlines[date];
          if (deadlines && deadlines.length > 0) {
            var targetId = deadlines[0].id;
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
      }

      $container.append($day);
    }

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
