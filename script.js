// ====== การตั้งค่า (สำคัญมาก!) ======
// 1. ใส่ API Key ของคุณที่ได้จาก Google Cloud Console
const API_KEY = 'AIzaSyDdoE28Fk8NDq_vmj6k17xOWzQp6mVjbiI'; // <-- ใส่คีย์ใหม่ที่สร้างแทนที่อันนี้

// 2. ใส่ ID ของ Google Sheet ของคุณ
const SHEET_ID = '1qEHMS50qs95rAwcGzFZxyx3uJMqsjvgSKIqVjL3fSBg';

// 3. ระบุชื่อและช่วงของข้อมูลในชีต (ขยายไปถึงคอลัมน์ N)
const RANGE = 'Sheet1!A2:N'; 
// ===================================


// URL สำหรับเรียกใช้ Google Sheets API
const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}&_=${new Date().getTime()}`;

// อ้างอิงถึง Element ต่างๆ ใน HTML
const tablesContainer = document.getElementById('tables-container');
const loader = document.getElementById('loader');
const dateFilter = document.getElementById('date-filter');
const dayFilter = document.getElementById('day-filter');
const storeFilter = document.getElementById('store-filter');
const quantityFilter = document.getElementById('quantity-filter');
const lastUpdatedSpan = document.getElementById('last-updated');
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.querySelector('.close-btn');


let allTables = []; 

// ฟังก์ชันหลักสำหรับดึงข้อมูลและเริ่มการทำงาน
async function fetchData() {
    loader.style.display = 'block';
    tablesContainer.innerHTML = '';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`เกิดข้อผิดพลาด: ${response.statusText}`);
        }
        const data = await response.json();
        
        allTables = (data.values || []).map(row => ({
            storeName: row[0] || 'N/A',
            zone: row[1] || '-',
            tableNumber: row[2] || '-',
            quantity: parseInt(row[3], 10) || 0,
            pricePerTable: parseInt(row[4], 10) || 0,
            creditPrice: parseInt(row[5], 10) || 0,
            total: parseInt(row[6], 10) || 0,
            status: row[7] || 'N/A',
            bookedBy: row[8] || '-',
            date: row[9] || 'N/A',
            dayOfWeek: row[10] ? row[10].trim() : 'N/A',
            notes: row[11] || '',
            hashtag: row[12] || 'N/A',
            layoutImage: row[13] || null,
        }));

        // --- จุดที่แก้ไข: เพิ่มการเรียงข้อมูลตามวันที่ ---
        // ฟังก์ชันช่วยแปลง 'MM/DD/YYYY' เป็น Date object ที่ถูกต้อง
        const parseDate = (dateString) => {
            if (!dateString || !dateString.includes('/')) return null;
            const parts = dateString.split('/');
            if (parts.length < 3) return null;
            // รูปแบบเดือนใน JavaScript คือ 0-11 (ม.ค.=0)
            return new Date(parts[2], parts[0] - 1, parts[1]);
        };

        allTables.sort((a, b) => {
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            
            if (!dateA) return 1;  // ผลักข้อมูลที่ไม่มีวันที่ไปไว้ท้ายสุด
            if (!dateB) return -1;

            return dateA - dateB; // เรียงจากวันที่น้อยไปมาก (ใกล้สุดไปไกลสุด)
        });
        // ---------------------------------------------

        populateFilters();
        applyFilters();
        updateLastUpdatedTime();

    } catch (error) {
        console.error('ไม่สามารถดึงข้อมูลได้:', error);
        tablesContainer.innerHTML = `<p style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการตั้งค่า API Key หรือ Sheet ID</p>`;
    } finally {
        loader.style.display = 'none';
    }
}

// ฟังก์ชันสร้างตัวเลือกในฟิลเตอร์
function populateFilters() {
    const dates = [...new Set(allTables.map(t => t.date).filter(item => item && item !== 'N/A'))];
    const days = [...new Set(allTables.map(t => t.dayOfWeek).filter(item => item && item !== 'N/A'))];
    const storeNames = [...new Set(allTables.map(t => t.storeName).filter(item => item && item !== 'N/A'))];
    const quantities = [...new Set(allTables.map(t => t.quantity).filter(q => q > 0))].sort((a,b) => a - b);
    
    dateFilter.innerHTML = '<option value="all">ทุกวันที่</option>';
    dayFilter.innerHTML = '<option value="all">ทุกวัน</option>';
    storeFilter.innerHTML = '<option value="all">ทุกร้าน</option>';
    quantityFilter.innerHTML = '<option value="all">ทุกจำนวนโต๊ะ</option>';

    dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = formatThaiDate(date);
        dateFilter.appendChild(option);
    });

    const thaiDayNames = { 'Fri': 'วันศุกร์', 'Sat': 'วันเสาร์', 'Sun': 'วันอาทิตย์', 'Mon': 'วันจันทร์', 'Tue': 'วันอังคาร', 'Wed': 'วันพุธ', 'Thu': 'วันพฤหัสบดี' };
    days.forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = thaiDayNames[day] || day;
        dayFilter.appendChild(option);
    });

    storeNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        storeFilter.appendChild(option);
    });

    quantities.forEach(qty => {
        const option = document.createElement('option');
        option.value = qty;
        option.textContent = `${qty} โต๊ะ`;
        quantityFilter.appendChild(option);
    });
}

// ฟังก์ชันแสดงผลการ์ดข้อมูลโต๊ะ
function renderTables(tables) {
    tablesContainer.innerHTML = ''; 
    if (tables.length === 0) {
        tablesContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary);">ไม่พบโต๊ะที่ตรงกับเงื่อนไข</p>`;
        return;
    }

    tables.forEach(table => {
        const card = document.createElement('div');
        card.className = 'table-card';

        const [formattedDate, formattedDay] = formatThaiDateAndDay(table.date, table.dayOfWeek);
        
        const storeThemes = {
            'Hashtag': 'hashtag-theme',
            'replayground': 'replayground-theme',
            'Sigma': 'sigma-theme'
        };
        const themeClass = storeThemes[table.storeName] || '';

        const layoutButtonHTML = table.layoutImage 
            ? `<button class="layout-btn" data-img-src="${table.layoutImage}">ดูผังโต๊ะ</button>` 
            : '';

        const notesHTML = table.notes
            ? `
            <div class="notes-section">
                <div class="detail-label">หมายเหตุ</div>
                <div class="detail-value">${table.notes}</div>
            </div>
            `
            : '';

        card.innerHTML = `
            <div class="card-header ${themeClass}">
                <h2 class="store-name">${table.storeName}</h2>
                <div class="date-info">
                    <span class="date-tag">${formattedDate}</span>
                    <span class="day-tag">${formattedDay}</span>
                </div>
            </div>
            <div class="card-body">
                <div class="detail-row">
                    <span class="detail-label">โซน</span>
                    <span class="detail-value">${table.zone}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">หมายเลขโต๊ะ</span>
                    <span class="detail-value">${table.tableNumber}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">จำนวนโต๊ะ</span>
                    <span class="detail-value">${table.quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ราคาต่อโต๊ะ</span>
                    <span class="detail-value">${table.pricePerTable.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ราคาเครดิต/มัดจำ</span>
                    <span class="detail-value">${table.creditPrice.toLocaleString()}</span>
                </div>
                ${notesHTML}
            </div>
            <div class="card-footer">
                <div class="total-row">
                    <span class="total-label">รวม</span>
                    <span class="total-price">${table.total.toLocaleString()} บาท</span>
                </div>
                ${layoutButtonHTML}
            </div>
        `;
        tablesContainer.appendChild(card);
    });
}

// ฟังก์ชันกรองข้อมูลตามที่ผู้ใช้เลือก
function applyFilters() {
    const selectedDate = dateFilter.value;
    const selectedDay = dayFilter.value;
    const selectedStore = storeFilter.value;
    const selectedQuantity = quantityFilter.value;

    const filteredTables = allTables
        .filter(table => table.status && table.status.trim() === 'ว่าง')
        .filter(table => selectedDate === 'all' || table.date === selectedDate)
        .filter(table => selectedDay === 'all' || table.dayOfWeek === selectedDay)
        .filter(table => selectedStore === 'all' || table.storeName === selectedStore)
        .filter(table => selectedQuantity === 'all' || table.quantity == selectedQuantity);
    
    renderTables(filteredTables);
}

// ----- ฟังก์ชันเสริม -----
function formatThaiDate(dateString) {
    if (!dateString || !dateString.includes('/')) return 'N/A';
    const parts = dateString.split('/');
    if (parts.length < 3) return dateString;
    const [month, day, year] = parts;
    return `${day}/${month}/${parseInt(year) + 543}`;
}

function formatThaiDateAndDay(dateString, dayString) {
     const thaiDays = { 'Sun':'อาทิตย์', 'Mon':'จันทร์', 'Tue':'อังคาร', 'Wed':'พุธ', 'Thu':'พฤหัส', 'Fri':'ศุกร์', 'Sat':'เสาร์' };
     const formattedDate = formatThaiDate(dateString);
     const formattedDay = dayString ? (thaiDays[dayString.trim()] || dayString) : '-';
     return [formattedDate, formattedDay];
}


function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    lastUpdatedSpan.textContent = timeString;
}

// ----- จัดการ Modal สำหรับแสดงรูปภาพ -----
tablesContainer.addEventListener('click', function(event) {
    if (event.target.classList.contains('layout-btn')) {
        const imgSrc = event.target.getAttribute('data-img-src');
        modalImg.src = imgSrc;
        modal.style.display = 'block';
    }
});

closeModal.onclick = function() {
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}


// ----- เริ่มการทำงาน -----
dateFilter.addEventListener('change', applyFilters);
dayFilter.addEventListener('change', applyFilters);
storeFilter.addEventListener('change', applyFilters);
quantityFilter.addEventListener('change', applyFilters);

document.addEventListener('DOMContentLoaded', fetchData);