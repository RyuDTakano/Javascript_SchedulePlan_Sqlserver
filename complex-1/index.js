



// ECharts Gantt-like Timeline Chart: Each process is a bar spanning its start and end time

function loadECharts(callback) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
  script.onload = callback;
  document.head.appendChild(script);
}


async function drawEChart() {
  const container = document.getElementById('timeline');
  // Add lot filter select below chart if not present
  let lotFilter = document.getElementById('lot-filter');
  if (!lotFilter) {
    lotFilter = document.createElement('select');
    lotFilter.id = 'lot-filter';
    lotFilter.style.display = 'block';
    lotFilter.style.margin = '30px auto 0 auto';
    lotFilter.style.fontSize = '24px';
    lotFilter.style.padding = '12px 32px';
    lotFilter.style.border = '2.5px solid #333';
    lotFilter.style.borderRadius = '22px';
    lotFilter.style.background = 'linear-gradient(90deg, #fff 80%, #f0f0f0 100%)';
    lotFilter.style.color = '#111';
    lotFilter.style.setProperty('color', '#111', 'important');
    lotFilter.style.maxWidth = '420px';
    lotFilter.style.minWidth = '220px';
    lotFilter.style.textAlign = 'center';
    lotFilter.style.position = 'relative';
    lotFilter.style.left = '0';
    lotFilter.style.right = '0';
    lotFilter.style.marginBottom = '36px';
    lotFilter.style.boxShadow = '0 4px 18px #0001, 0 1.5px 0 #fff inset';
    lotFilter.style.transition = 'box-shadow 0.2s, border 0.2s';
    lotFilter.onfocus = () => { lotFilter.style.boxShadow = '0 6px 24px #0002'; lotFilter.style.border = '2.5px solid #2196f3'; };
    lotFilter.onblur = () => { lotFilter.style.boxShadow = '0 4px 18px #0001, 0 1.5px 0 #fff inset'; lotFilter.style.border = '2.5px solid #333'; };
    container.parentNode.insertBefore(lotFilter, container.nextSibling);
  }
  // --- Add refresh and auto-refresh controls (after lotFilter is created) ---
  let controls = document.getElementById('refresh-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'refresh-controls';
    controls.style.display = 'flex';
    controls.style.justifyContent = 'center';
    controls.style.gap = '24px';
    controls.style.margin = '18px auto 0 auto';
    controls.style.fontSize = '28px';
    controls.style.alignItems = 'center';
    controls.style.width = '100%';
    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refresh-btn';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.style.fontSize = '28px';
    refreshBtn.style.padding = '8px 32px';
    refreshBtn.style.border = '2px solid #888';
    refreshBtn.style.borderRadius = '8px';
    refreshBtn.style.background = '#f5f5f5';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.onclick = () => drawEChart();
    // Start/Stop auto-refresh button
    const autoBtn = document.createElement('button');
    autoBtn.id = 'auto-refresh-btn';
    autoBtn.textContent = 'Start Auto-Refresh';
    autoBtn.style.fontSize = '28px';
    autoBtn.style.padding = '8px 32px';
    autoBtn.style.border = '2px solid #888';
    autoBtn.style.borderRadius = '8px';
    autoBtn.style.background = '#f5f5f5';
    autoBtn.style.cursor = 'pointer';
    controls.appendChild(refreshBtn);
    controls.appendChild(autoBtn);
    lotFilter.parentNode.insertBefore(controls, lotFilter.nextSibling);
  }
  // --- Auto-refresh logic ---
  window._autoRefreshTimer = window._autoRefreshTimer || null;
  const autoBtn = document.getElementById('auto-refresh-btn');
  function setAutoBtnText() {
    if (window._autoRefreshTimer) {
      autoBtn.textContent = 'Stop Auto-Refresh';
      autoBtn.style.background = '#ffe0e0';
    } else {
      autoBtn.textContent = 'Start Auto-Refresh';
      autoBtn.style.background = '#f5f5f5';
    }
  }
  setAutoBtnText();
  autoBtn.onclick = function() {
    if (window._autoRefreshTimer) {
      clearInterval(window._autoRefreshTimer);
      window._autoRefreshTimer = null;
      setAutoBtnText();
    } else {
      window._autoRefreshTimer = setInterval(() => {
        drawEChart();
      }, 2000); // timer
      setAutoBtnText();
    }
  };
  // Always use sessionStorage for filter value
  let savedLot = sessionStorage.getItem('lotFilterValue') || '';
  // Set container width dynamically based on total column width
  // grid.left + grid.right + sum(colWidths)
  const gridLeft = 500;
  const gridRight = 500;
  const gridTop = 320; // add more space above chart
  const gridBottom = 180;
  const chartHeight = 1800;
  const yStart = 5; // for empty row above 6:00
  const yEnd = 19; // add empty row below 18:00
  // Bar width constants (must be defined before any use)
  const baseBarWidth = 180;
  const minBarWidth = 180;
  // Fetch line numbers from backend and use as columns
  let lines = [];
  try {
    const res = await fetch('http://localhost:3001/lines');
    lines = await res.json();
  } catch (e) {
    lines = [
      { line_no: 'L1', line_name: 'Line 1' },
      { line_no: 'L2', line_name: 'Line 2' },
      { line_no: 'L3', line_name: 'Line 3' }
    ];
  }
  // Only use line_no for all logic and display
  const lineNos = lines.map(l => l.line_no);
  // Fetch jobs for all lines in parallel for speed
  let jobs = [];
  const jobFetches = lineNos.map(line_no =>
    fetch(`http://localhost:3001/jobs?line_no=${encodeURIComponent(line_no)}`)
      .then(res => res.json())
      .then(lineJobs => lineJobs.map(job => {
        const startDate = new Date(job.start_time);
        const endDate = new Date(job.end_time);
        return {
          line_no: line_no,
          lot_no: job.lot_no,
          log_id: job.log_id,
          process_no: job.process_no,
          process_name: job.process_name,
          status: job.status,
          start: startDate.getUTCHours() + startDate.getUTCMinutes()/60,
          end: endDate.getUTCHours() + endDate.getUTCMinutes()/60,
          raw: job // keep all original fields for tooltip
        };
      }))
      .catch(e => {
        console.error('Error fetching jobs for', line_no, e);
        return [];
      })
  );
  const allJobs = await Promise.all(jobFetches);
  jobs = allJobs.flat();

  // Populate lot filter select
  const uniqueLots = Array.from(new Set(jobs.map(j => j.lot_no))).filter(lot => lot != null && lot !== '').sort();
  lotFilter.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'All Lots';
  allOpt.style.color = '#111';
  allOpt.style.setProperty('color', '#111', 'important');
  lotFilter.appendChild(allOpt);
  for (const lot of uniqueLots) {
    const opt = document.createElement('option');
    opt.value = lot;
    opt.textContent = lot;
    opt.style.color = '#111';
    opt.style.setProperty('color', '#111', 'important');
    lotFilter.appendChild(opt);
  }
  lotFilter.value = savedLot;

  // Filtering logic
  function filterJobsByLot(jobs, lot) {
    if (!lot) return jobs;
    return jobs.filter(j => j.lot_no === lot);
  }

  // Redraw chart on lot filter change
  lotFilter.onchange = function() {
    sessionStorage.setItem('lotFilterValue', lotFilter.value);
    drawEChart();
  };

  // If called from filter, only show filtered jobs
  if (savedLot) {
    jobs = filterJobsByLot(jobs, savedLot);
  }
  // Assign swimlanes for overlapping jobs in each column
  function assignLanes(jobs, lineNos) {
    const jobsByLine = {};
    lineNos.forEach(no => jobsByLine[no] = []);
    jobs.forEach(job => jobsByLine[job.line_no].push(job));
    const maxLanesByLine = {};
    const barData = [];
    for (const line_no of lineNos) {
      const jobsForLine = jobsByLine[line_no].slice().sort((a, b) => a.start - b.start);
      const lanes = [];
      let maxLane = 1;
      jobsForLine.forEach(job => {
        let lane = 0;
        while (lanes[lane] && lanes[lane] > job.start) lane++;
        job._lane = lane;
        lanes[lane] = job.end;
        maxLane = Math.max(maxLane, lane + 1);
        barData.push([
          lineNos.indexOf(job.line_no),
          job.start,
          job.end,
          job.lot_no,
          lane,
          job, // still pass job for tooltip
          job.status !== undefined ? job.status : '' // pass status as string for color logic
        ]);
      });
      // Ensure at least one lane for columns with no jobs
      if (jobsForLine.length === 0) {
        maxLane = 1;
      }
      maxLanesByLine[line_no] = maxLane;
    }
    return { barData, maxLanesByLine };
  }
  const { barData, maxLanesByLine } = assignLanes(jobs, lineNos);

  // Helper for redraw with filter
  window.drawEChartWithLot = function(lot) {
    sessionStorage.setItem('lotFilterValue', lot || '');
    drawEChart();
  };
  // Now fill colWidths and colLefts
  let acc = 0;
  let colLefts = [0];
  let colWidths = [];
  for (let i = 0; i < lineNos.length; i++) {
    // Always allocate at least one lane for every column
    const maxLanes = Math.max(maxLanesByLine[lineNos[i]] || 1, 1);
    const w = Math.max(baseBarWidth * maxLanes, minBarWidth);
    colWidths.push(w);
    acc += w;
    colLefts.push(acc);
  }
  // Set container width dynamically
  const totalWidth = gridLeft + gridRight + acc;
  container.style.width = totalWidth + 'px';
  container.style.height = chartHeight + 'px';
  const myChart = echarts.init(container);

  const option = {
    title: {
      text: 'Schedule Plan',
      left: 'center',
      top: 40,
      textStyle: { fontSize: 48 }
    },
    tooltip: {
      formatter: function(params) {
        if (!Array.isArray(params.value)) return '';
        const [lineIdx, start, end, lot_no, lane, job] = params.value;
        // Always use job.raw if present, else job, else empty object
        const raw = (job && job.raw) ? job.raw : (job || {});
        // Helper for time
        function fmt(dt) {
          if (!dt) return '-';
          const d = new Date(dt);
          if (isNaN(d.getTime())) return '-';
          const h = d.getUTCHours().toString().padStart(2, '0');
          const m = d.getUTCMinutes().toString().padStart(2, '0');
          return `${h}:${m}`;
        }
        // Use line_no for column header
        const lineNo = lineNos && lineNos[lineIdx] ? lineNos[lineIdx] : '-';
        const lineName = lineNo;
        // Build table rows for all fields
        const fields = [
          ['Line No', raw.line_no],
          ['Lot No', raw.lot_no],
          ['Status', raw.status],
          ['Process No', raw.process_no],
          ['Process Name', raw.process_name],
          ['Material No', raw.material_no],
          ['Qty Used', raw.qty_used],
          ['Process Time', raw.process_time],
          ['Queue Position', raw.queue_position],
          ['Result', raw.result],
          ['Delay Reason', raw.delay_reason],
          ['Operator', raw.operator],
          ['Log ID', raw.log_id],
          ['Schedule Start', fmt(raw.schedule_dt)],
          ['Schedule End', fmt(raw.speculate_end_dt)],
          ['Actual Start', fmt(raw.start_dt)],
          ['Actual End', fmt(raw.end_dt)]
        ];
        let tableRows = fields.map(([k, v]) => `<tr><td style="font-weight:bold;color:#333;">${k}</td><td>${v !== undefined ? v : '-'}</td></tr>`).join('');
        // Show image in floating div if present
        console.log('Tooltip raw.img:', raw.img, raw);
        if (raw.img) {
          let imgDiv = document.getElementById('echarts-tooltip-img');
          if (!imgDiv) {
            imgDiv = document.createElement('div');
            imgDiv.id = 'echarts-tooltip-img';
            imgDiv.style.position = 'fixed';
            imgDiv.style.zIndex = 9999;
            imgDiv.style.pointerEvents = 'none';
            imgDiv.style.display = 'none';
            document.body.appendChild(imgDiv);
          }
          imgDiv.innerHTML = `<img src="${raw.img}" style="max-width:600px;max-height:800px;border:2px solid #888;background:#fff;box-shadow:0 2px 12px #0002;"/>`;
          imgDiv.style.display = 'block';
        } else {
          const imgDiv = document.getElementById('echarts-tooltip-img');
          if (imgDiv) imgDiv.style.display = 'none';
        }
        return `
<div style="font-size:26px;line-height:1.5;min-width:320px;max-width:500px;">
  <div style="font-weight:bold;font-size:30px;color:#2a3b8f;margin-bottom:4px;">${lineName}</div>
  <table style="font-size:26px;width:100%;border-collapse:collapse;">
    ${tableRows}
  </table>
</div>
        `;
      },
      position: function (point, params, dom, rect, size) {
        // Move the floating image next to the tooltip, with extra margin
        const imgDiv = document.getElementById('echarts-tooltip-img');
        if (imgDiv && imgDiv.style.display === 'block') {
          // point: [x, y] of tooltip
          let left = point[0] + 440; // 150px margin to the right
          let top = point[1] - 10;
          // Prevent overflow
          if (left + 240 > window.innerWidth) left = window.innerWidth - 240;
          if (top < 0) top = 0;
          imgDiv.style.left = left + 'px';
          imgDiv.style.top = top + 'px';
        }
        return point;
      },
      hideDelay: 100,
    },
    grid: { left: gridLeft, right: gridRight, bottom: gridBottom, top: gridTop },
    xAxis: {
      type: 'value',
      min: 0,
      max: acc,
      name: 'Line',
      position: 'top',
      nameTextStyle: { fontSize: 36, fontWeight: 'bold' },
      axisLabel: {
        show: false
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { width: 4 } },
      splitLine: { show: false },
    },
    yAxis: {
      min: yStart,
      max: yEnd,
      interval: 1,
      type: 'value',
      name: 'Time',
      position: 'left', // keep y-axis on the left
      inverse: true,
      nameTextStyle: { fontSize: 36, fontWeight: 'bold', padding: [0,0,20,0] },
      axisLabel: {
        formatter: function(val) {
          if (val < 6 || val > 18) return '';
          return val + ':00';
        },
        fontSize: 32,
        margin: 48 // more margin to float above grid
      },
      axisLine: { lineStyle: { width: 4 } },
      splitLine: { lineStyle: { type: 'dashed', color: '#ccc', width: 2 } },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['#fff', '#f0f0f0']
        }
      }
    },
    series: [
      // Faint background for every column (even if empty)
      {
        type: 'custom',
        renderItem: function(params, api) {
          const xIndex = params.dataIndex;
          const colWidth = colWidths[xIndex];
          let colLeft = 0;
          for (let i = 0; i < xIndex; i++) {
            colLeft += colWidths[i];
          }
          return {
            type: 'rect',
            shape: {
              x: colLeft + gridLeft,
              y: gridTop,
              width: colWidth,
              height: chartHeight - gridTop - gridBottom
            },
            style: {
              fill: '#e0e0e0',
              opacity: 0.18
            }
          };
        },
        data: lineNos.map((_, i) => i),
        silent: true,
        z: 2
      },
      // Background stripes for rows (time slots)
      {
        type: 'custom',
        renderItem: function(params, api) {
          const yVal = params.data;
          const yStartPx = api.coord([0, yVal])[1];
          const yEndPx = api.coord([0, yVal + 1])[1];
          return {
            type: 'rect',
            shape: {
              x: gridLeft,
              y: yStartPx,
              width: acc,
              height: yEndPx - yStartPx
            },
            style: {
              fill: yVal < 6 ? '#fff' : (yVal % 2 === 0 ? '#fff' : '#f0f0f0'),
              opacity: 1,
              stroke: '#d0d0d0',
              lineWidth: 1
            }
          };
        },
        data: Array.from({length: yEnd - yStart}, (_, i) => yStart + i), // 5 to 18 (14 rows)
        silent: true,
        z: 1
      },
      // Custom series for bars
      {
        z: 100,
        type: 'custom',
        renderItem: function(params, api) {
          const xIndex = api.value(0);
          const start = api.value(1);
          const end = api.value(2);
          const label = api.value(3);
          const lane = api.value(4) || 0;
          const job = api.value(5);
          let status = api.value(6) || '';
          // Normalize status string for robust color matching
          status = String(status).toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
          let fill = '#aaa';
          if (status === 'working') {
            fill = 'orange';
          } else if (status === 'in queue' || status === 'in-quene' || status === 'inqueue') {
            fill = '#2196f3';
          } else if (status === 'complete' || status === 'completed') {
            fill = '#43a047';
          } else {
            fill = '#aaa';
          }
          // Debug: log status and fill for this bar
          // console.log('Bar:', label, 'Status:', status, 'Fill:', fill);
          // Use lineNos for logic, lineNameMap for display
          const lineNo = lineNos[xIndex];
          const maxLanes = maxLanesByLine[lineNo] || 1;
          const colWidth = Math.max(baseBarWidth * maxLanes, minBarWidth);
          const laneWidth = colWidth / maxLanes;
          // Calculate left edge of this column by summing widths of previous columns
          let colLeft = 0;
          for (let i = 0; i < xIndex; i++) {
            const prevLine = lineNos[i];
            const prevLanes = maxLanesByLine[prevLine] || 1;
            colLeft += Math.max(baseBarWidth * prevLanes, minBarWidth);
          }
          // Place each bar in its swimlane, always inside the column slot
          const x = colLeft + lane * laneWidth;
          // Map y to value axis
          const yStart = api.coord([0, start])[1];
          const yEnd = api.coord([0, end])[1];
          return {
            type: 'rect',
            shape: {
              x: x + 500, // grid.left
              y: yStart,
              width: laneWidth,
              height: yEnd - yStart
            },
            style: api.style({
              fill,
              shadowBlur: 12,
              shadowColor: 'rgba(0,0,0,0.15)'
            })
          };
        },
      label: {
        show: true,
        position: 'inside',
        formatter: function(params) {
          return params.value[3];
        },
        fontSize: 28,
        color: '#111',
        fontWeight: 'bold',
        overflow: 'break',
        width: 100
      },
      encode: {
        x: 0,
        y: [1, 2],
        tooltip: [0, 1, 2, 3, 4]
      },
        data: barData
      },
      // Custom series for x-axis labels (column names)
      {
        z: 110,
        type: 'custom',
        renderItem: function(params, api) {
          const xIndex = params.dataIndex;
          const colWidth = colWidths[xIndex];
          let colLeft = 0;
          for (let i = 0; i < xIndex; i++) {
            colLeft += colWidths[i];
          }
          return {
            type: 'text',
            style: {
              text: lineNos[xIndex],
              x: colLeft + colWidth / 2 + gridLeft,
              y: gridTop - 50, // lower, just above the grid
              textAlign: 'center',
              textVerticalAlign: 'middle',
              font: '64px sans-serif',
              fontSize: 64,
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
              fill: '#333'
            }
          };
        },
        data: lineNos.map((_, i) => i),
        z: 10
      },
      // Custom series for vertical lines between columns
      {
        z: 120,
        type: 'custom',
        renderItem: function(params, api) {
          const xIndex = params.dataIndex;
          if (xIndex === colWidths.length - 1) return null; // No line after last column
          let colRight = 0;
          for (let i = 0; i <= xIndex; i++) {
            colRight += colWidths[i];
          }
          const x = colRight + 500; // grid.left
          return {
            type: 'line',
            shape: {
              x1: x,
              y1: 220, // grid.top
              x2: x,
              y2: 1620 // grid.top + grid.height
            },
            style: {
              stroke: '#888',
              lineWidth: 3,
              opacity: 0.7
            }
          };
        },
        data: lineNos.slice(0, -1).map((_, i) => i),
        z: 5
      }
    ]
  };
  myChart.setOption(option);
  // Hide floating image when not hovering a bar
  setTimeout(() => {
    const chartDom = document.getElementById('timeline');
    if (!chartDom || !window.echarts) return;
    const chart = window.echarts.getInstanceByDom(chartDom);
    if (!chart) return;
    chart.on('globalout', function() {
      const imgDiv = document.getElementById('echarts-tooltip-img');
      if (imgDiv) imgDiv.style.display = 'none';
    });
    chart.on('mouseout', function() {
      const imgDiv = document.getElementById('echarts-tooltip-img');
      if (imgDiv) imgDiv.style.display = 'none';
    });
    chart.on('mousemove', function(params) {
      // If not on a bar, hide image
      if (!params || !params.seriesType || params.seriesType !== 'custom') {
        const imgDiv = document.getElementById('echarts-tooltip-img');
        if (imgDiv) imgDiv.style.display = 'none';
      }
    });
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  // Inject global CSS for <option> font size (try 36px for maximum visibility)
  const style = document.createElement('style');
  style.innerHTML = 'select#lot-filter, select#lot-filter option { font-size: 36px !important; min-height: 48px !important; }';
  document.head.appendChild(style);
  if (!document.getElementById('timeline')) {
    const div = document.createElement('div');
    div.id = 'timeline';
    div.style.width = '3500px';
    div.style.height = '1800px';
    document.body.appendChild(div);
  }
  loadECharts(drawEChart);
});
