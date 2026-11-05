(() => {
  "use strict";
  const STORAGE_KEY = "myFinanceData_v2";
  const CATEGORIES = [
    ["Продукты",35],["Транспорт",10],["Быт и дом",8],["Здоровье",5],
    ["Одежда и личное",7],["Кафе и развлечения",10],["Свободные деньги",25]
  ];
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number(n)||0);
  const today = new Date();
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const currentMonth = () => localDate(today).slice(0,7);
  const safeNum = v => Math.max(0, Number(v)||0);
  const defaults = () => ({
    incomes:[], fixed:{credit1:0,credit2:0,housing:0,utilities:0,phone:0,otherFixed:0},
    shares:CATEGORIES.map(([name,pct])=>({name,pct}))
  });
  let state = loadState(), selectedMonth = currentMonth(), editingId = null;
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return defaults();
      const parsed = JSON.parse(raw), base = defaults();
      const fixed = {...base.fixed,...(parsed.fixed||{})};
      const shares = Array.isArray(parsed.shares) && parsed.shares.length
        ? parsed.shares.map(x=>({name:String(x.name||"Категория"),pct:safeNum(x.pct)}))
        : base.shares;
      const incomes = Array.isArray(parsed.incomes) ? parsed.incomes.filter(x=>x && Number(x.amount)>0 && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).map(x=>({...x,id:x.id||makeId(),amount:safeNum(x.amount),note:String(x.note||"")})) : [];
      return {incomes,fixed,shares};
    } catch { return defaults(); }
  }
  function save(){
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
    catch(error) { toast("Не удалось сохранить данные в памяти браузера. Проверь настройки Safari."); console.error("MY FINANCE storage error",error); }
  }
  function makeId(){return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
  function monthIncomes(){return state.incomes.filter(x=>x.date.slice(0,7)===selectedMonth);}
  function totals(){
    const income=monthIncomes().reduce((s,x)=>s+x.amount,0);
    const reserve=income*.10;
    const fixed=Object.values(state.fixed).reduce((s,x)=>s+safeNum(x),0);
    return {income,reserve,fixed,available:Math.max(0,income-reserve-fixed),shortage:Math.max(0,reserve+fixed-income)};
  }
  function render(){
    const t=totals();
    $("monthPicker").value=selectedMonth;
    $("monthIncome").textContent=money(t.income);
    $("monthReserve").textContent=money(t.reserve);
    $("fixedTotal").textContent=money(t.fixed);
    $("availableTotal").textContent=money(t.available);
    $("allReserve").textContent=money(state.incomes.reduce((s,x)=>s+x.amount*.10,0));
    $("shortageNotice").classList.toggle("hidden",t.shortage<=0);
    $("shortageNotice").textContent=t.shortage>0?`Дохода не хватает на резерв и обязательные платежи: ${money(t.shortage)}. Распределение категорий пока рассчитано от нуля.`:"";
    const sum=state.shares.reduce((s,x)=>s+safeNum(x.pct),0);
    $("sharesTotal").textContent=`${sum}%`;
    $("categories").innerHTML=state.shares.map(c=>{
      const amount=t.available*safeNum(c.pct)/100;
      return `<article class="category-item"><div class="cat-top"><span class="cat-name">${esc(c.name)}</span><strong class="cat-amount">${money(amount)}</strong></div><div class="cat-bottom"><span>${safeNum(c.pct)}% от остатка</span><span>${money(t.available)} база</span></div><div class="progress"><span style="width:${Math.min(100,safeNum(c.pct))}%"></span></div></article>`;
    }).join("");
    const list=monthIncomes().sort((a,b)=>b.date.localeCompare(a.date));
    $("incomeList").innerHTML=list.map(x=>`<div class="income-row"><div class="income-symbol">↗</div><div class="income-info"><strong>${money(x.amount)}</strong><small>${formatDate(x.date)}${x.note?` · ${esc(x.note)}`:""}</small></div><div class="row-actions"><button aria-label="Изменить" data-edit="${esc(x.id)}">✎</button><button aria-label="Удалить" data-delete="${esc(x.id)}">×</button></div></div>`).join("");
    $("emptyIncome").classList.toggle("hidden",list.length>0);
  }
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function formatDate(s){const [y,m,d]=s.split("-");return `${d}.${m}.${y}`;}
  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300);}
  function openModal(id){$(id).classList.remove("hidden");}
  function closeModal(id){$(id).classList.add("hidden");}
  function openIncome(item=null){
    editingId=item?.id||null;
    $("incomeModalTitle").textContent=item?"Изменить доход":"Добавить доход";
    $("incomeAmount").value=item?.amount??"";
    $("incomeDate").value=item?.date??localDate(today);
    $("incomeNote").value=item?.note??"";
    openModal("incomeModal");
  }
  function openSettings(){
    for(const key of Object.keys(state.fixed)) $(key).value=state.fixed[key];
    $("shareInputs").innerHTML=state.shares.map((c,i)=>`<label class="share-row"><span>${esc(c.name)}</span><input type="number" min="0" max="100" step="1" data-share="${i}" value="${safeNum(c.pct)}" inputmode="numeric"></label>`).join("");
    updateShareValidation(); openModal("settingsModal");
  }
  function updateShareValidation(){
    const total=[...document.querySelectorAll("[data-share]")].reduce((s,x)=>s+safeNum(x.value),0);
    const el=$("shareValidation");el.textContent=`Итого: ${total}%`;el.classList.toggle("invalid",total!==100);
    el.style.color=total===100?"":"";
  }
  $("monthPicker").addEventListener("change",e=>{if(e.target.value)selectedMonth=e.target.value;render();});
  $("todayBtn").addEventListener("click",()=>{selectedMonth=currentMonth();render();});
  $("addIncomeOpen").addEventListener("click",()=>openIncome());
  $("settingsOpen").addEventListener("click",openSettings);
  $("editShares").addEventListener("click",openSettings);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  document.querySelectorAll(".modal-backdrop").forEach(b=>b.addEventListener("click",e=>{if(e.target===b)closeModal(b.id);}));
  $("incomeForm").addEventListener("submit",e=>{
    e.preventDefault();const amount=safeNum($("incomeAmount").value),date=$("incomeDate").value;
    if(!amount||!date){toast("Укажи сумму и дату");return;}
    const item={id:editingId||makeId(),amount,date,note:$("incomeNote").value.trim()};
    if(editingId)state.incomes=state.incomes.map(x=>x.id===editingId?item:x);else state.incomes.push(item);
    selectedMonth=date.slice(0,7);save();render();closeModal("incomeModal");toast("Доход сохранён");
  });
  $("incomeList").addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
    if(edit){const item=state.incomes.find(x=>x.id===edit.dataset.edit);if(item)openIncome(item);}
    if(del){const item=state.incomes.find(x=>x.id===del.dataset.delete);if(item&&confirm(`Удалить доход ${money(item.amount)}?`)){state.incomes=state.incomes.filter(x=>x.id!==item.id);save();render();toast("Доход удалён");}}
  });
  $("shareInputs").addEventListener("input",updateShareValidation);
  $("settingsForm").addEventListener("submit",e=>{
    e.preventDefault();
    const shares=[...document.querySelectorAll("[data-share]")].map((el,i)=>({...state.shares[i],pct:safeNum(el.value)}));
    const sum=shares.reduce((s,x)=>s+x.pct,0);
    if(sum!==100){toast(`Сумма долей должна быть 100%. Сейчас ${sum}%`);return;}
    const fixed={};for(const key of Object.keys(state.fixed))fixed[key]=safeNum($(key).value);
    state.fixed=fixed;state.shares=shares;save();render();closeModal("settingsModal");toast("Настройки сохранены");
  });
  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({app:"MY FINANCE",version:"3.0.1",exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`my-finance-backup-${localDate(today)}.json`;a.click();URL.revokeObjectURL(a.href);toast("Резервная копия подготовлена");
  });
  $("importBtn").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const parsed=JSON.parse(await file.text());const d=parsed.data||parsed;if(!Array.isArray(d.incomes)||!d.fixed||!Array.isArray(d.shares))throw new Error("bad");state={incomes:d.incomes,fixed:{...defaults().fixed,...d.fixed},shares:d.shares};save();render();toast("Данные импортированы");}
    catch{toast("Не удалось прочитать файл резервной копии");}
    e.target.value="";
  });
  $("resetBtn").addEventListener("click",()=>{
    if(!confirm("Удалить все доходы и настройки? Сначала сделай экспорт данных."))return;
    state=defaults();save();render();closeModal("settingsModal");toast("Данные сброшены");
  });
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  try { render(); }
  catch(error) { console.error("MY FINANCE render error",error); toast("Ошибка запуска интерфейса. Перезагрузи страницу."); }
})();