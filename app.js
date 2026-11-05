(() => {
"use strict";
const KEY="myFinanceData_v2";
const CATEGORIES=[
 ["Продукты",35],["Транспорт",10],["Быт и дом",8],["Здоровье",5],
 ["Одежда и личное",7],["Кафе и развлечения",10],["Свободные деньги",25]
];
const DEFAULTS={version:2,incomes:[],expenses:[],settings:{loan1:0,loan2:0,housing:0,utilities:0,phone:0,other:0},shares:CATEGORIES.map(([name,pct])=>({name,pct}))};
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(Math.round((Number(n)||0)*100)/100)+" ₽";
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const currentMonth=()=>today().slice(0,7);
let data=load();
let editing=null;
function load(){
 try{const raw=localStorage.getItem(KEY);if(!raw)return structuredClone(DEFAULTS);const d=JSON.parse(raw);
  if(!d||!Array.isArray(d.incomes)||!Array.isArray(d.expenses))throw 0;
  return {...structuredClone(DEFAULTS),...d,settings:{...DEFAULTS.settings,...(d.settings||{})},shares:Array.isArray(d.shares)&&d.shares.length?d.shares:structuredClone(DEFAULTS.shares)};
 }catch(e){return structuredClone(DEFAULTS)}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));render();return true}catch(e){toast("Не удалось сохранить данные. Освободите место в браузере и экспортируйте копию.");return false}}
function toast(s){const t=$("toast");t.textContent=s;t.style.display="block";clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display="none",2400)}
function month(){return $("period").value||currentMonth()}
function inMonth(x,m){return String(x.date||"").slice(0,7)===m}
function totals(m=month()){
 const incomes=data.incomes.filter(x=>inMonth(x,m));
 const expenses=data.expenses.filter(x=>inMonth(x,m));
 const income=incomes.reduce((s,x)=>s+Number(x.amount),0);
 const fund=income*.10;
 const fixed=Object.values(data.settings).reduce((s,x)=>s+Math.max(0,Number(x)||0),0);
 const mandatoryActual=expenses.filter(x=>x.kind==="mandatory").reduce((s,x)=>s+Number(x.amount),0);
 const variable=expenses.filter(x=>x.kind!=="mandatory").reduce((s,x)=>s+Number(x.amount),0);
 const mandatoryReserve=Math.max(0,fixed-mandatoryActual);
 const pool=Math.max(0,income-fund-Math.max(fixed,mandatoryActual));
 const spent=expenses.reduce((s,x)=>s+Number(x.amount),0);
 const available=income-fund-Math.max(fixed,mandatoryActual)-variable;
 return {incomes,expenses,income,fund,fixed,mandatoryActual,mandatoryReserve,pool,spent,variable,available};
}
function render(){
 const m=month(),t=totals(m);
 $("monthLabel").textContent=new Date(m+"-15T12:00:00").toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
 $("available").textContent=money(t.available);
 $("heroCaption").textContent=t.income?"После фонда и обязательств, с учётом записанных расходов":"Добавьте первый доход, чтобы начать учёт";
 $("incomeTotal").textContent=money(t.income);$("fundTotal").textContent=money(t.fund);
 $("mandatoryTotal").textContent=money(Math.max(t.fixed,t.mandatoryActual));$("spentTotal").textContent=money(t.spent);
 const budget=$("budgets");budget.innerHTML="";
 if(!t.income){budget.innerHTML='<div class="empty">Пока нет доходов за этот месяц.<br>Добавьте поступление — бюджет рассчитается автоматически.</div>'}
 else data.shares.forEach(c=>{
  const plan=t.pool*Number(c.pct)/100;
  const spent=t.expenses.filter(x=>x.kind!=="mandatory"&&x.category===c.name).reduce((s,x)=>s+Number(x.amount),0);
  const left=plan-spent,pct=plan>0?Math.min(100,spent/plan*100):0;
  const el=document.createElement("div");el.className="category";
  el.innerHTML=`<div class="row"><b>${esc(c.name)}</b><b>${money(plan)}</b></div><div class="row sub"><span>${Number(c.pct)}% бюджета · потрачено ${money(spent)}</span><b style="color:${left<0?'var(--red)':'var(--muted)'}">${left>=0?'осталось ':'перерасход '}${money(Math.abs(left))}</b></div><div class="progress"><i style="width:${pct}%"></i></div>`;
  budget.append(el);
 });
 const all=[...t.incomes.map(x=>({...x,type:"income"})),...t.expenses.map(x=>({...x,type:"expense"}))].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
 $("recentCount").textContent=all.length?`${all.length} записей`:"";
 $("recent").innerHTML=all.length?all.slice(0,5).map(x=>entryHTML(x,false)).join(""):'<div class="empty">Операций пока нет</div>';
 $("incomeList").innerHTML=t.incomes.length?t.incomes.slice().sort(sortDate).reverse().map(x=>entryHTML({...x,type:"income"},true)).join(""):'<div class="empty">Записей пока нет</div>';
 $("expenseList").innerHTML=t.expenses.length?t.expenses.slice().sort(sortDate).reverse().map(x=>entryHTML({...x,type:"expense"},true)).join(""):'<div class="empty">Записей пока нет</div>';
}
function sortDate(a,b){return a.date.localeCompare(b.date)||a.created-b.created}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function entryHTML(x,controls){
 const sign=x.type==="income"?"+":"−",color=x.type==="income"?"var(--mint)":"var(--red)";
 const title=x.type==="income"?x.source:(x.category+(x.note?" · "+x.note:""));
 const meta=x.type==="income"?"Поступление":(x.kind==="mandatory"?"Обязательный платёж":"Расход");
 return `<div class="entry"><div class="row"><div><div class="entry-title">${esc(title)}</div><div class="sub">${esc(x.date)} · ${meta}</div></div><div class="row"><b style="color:${color};white-space:nowrap">${sign} ${money(x.amount)}</b>${controls?`<button class="tiny edit" data-edit="${x.id}" data-type="${x.type}">Изменить</button><button class="tiny" data-delete="${x.id}" data-type="${x.type}">Удалить</button>`:""}</div></div></div>`;
}
function go(tab){
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===tab));
 document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 window.scrollTo({top:0,behavior:"instant"});
}
document.querySelectorAll("[data-tab],[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.tab||b.dataset.go)));
$("period").value=currentMonth();$("period").addEventListener("change",render);
["incomeForm","expenseForm"].forEach(id=>{
 const form=$(id);form.elements.date.value=today();
 form.addEventListener("submit",e=>{
  e.preventDefault();const fd=new FormData(form),amount=Number(fd.get("amount"));
  if(!Number.isFinite(amount)||amount<=0){toast("Укажите сумму больше нуля");return}
  const type=id==="incomeForm"?"income":"expense";
  const item={id:editing?.type===type?editing.id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),created:editing?.type===type?editing.created:Date.now(),amount,date:fd.get("date")};
  if(type==="income"){item.source=String(fd.get("source")).trim();if(!item.source){toast("Укажите источник дохода");return}}
  else {item.category=fd.get("category");item.kind=fd.get("kind");item.note=String(fd.get("note")||"").trim()}
  const arr=type==="income"?data.incomes:data.expenses;
  if(editing?.type===type){const index=arr.findIndex(x=>x.id===editing.id);if(index>=0)arr[index]=item;else arr.push(item)}else arr.push(item);
  editing=null;$(`${type}Submit`).textContent=type==="income"?"Добавить поступление":"Сохранить расход";
  $(`${type}Cancel`).hidden=true;$("period").value=item.date.slice(0,7);form.reset();form.elements.date.value=today();
  save();go(type);toast(type==="income"?"Доход сохранён":"Расход сохранён");
 });
});
function cancelEdit(type){editing=null;const form=$(type+"Form");form.reset();form.elements.date.value=today();$(type+"Submit").textContent=type==="income"?"Добавить поступление":"Сохранить расход";$(type+"Cancel").hidden=true;}
$("incomeCancel").addEventListener("click",()=>cancelEdit("income"));
$("expenseCancel").addEventListener("click",()=>cancelEdit("expense"));
function beginEdit(type,id){
 const arr=type==="income"?data.incomes:data.expenses;const item=arr.find(x=>x.id===id);if(!item)return;
 editing={type,id,created:item.created};const form=$(type+"Form");
 form.elements.amount.value=item.amount;form.elements.date.value=item.date;
 if(type==="income")form.elements.source.value=item.source||"";
 else {form.elements.category.value=item.category;form.elements.kind.value=item.kind||"variable";form.elements.note.value=item.note||""}
 $(type+"Submit").textContent="Сохранить изменения";$(type+"Cancel").hidden=false;go(type);toast("Измените данные и сохраните")
}

function renderSettings(){
 const f=$("settingsForm");Object.keys(data.settings).forEach(k=>{if(f.elements[k])f.elements[k].value=data.settings[k]});
 $("shares").innerHTML=data.shares.map((c,i)=>`<div class="settings-row row"><label style="margin:0;flex:1">${esc(c.name)}</label><div style="width:95px"><input type="number" min="0" max="100" step="1" data-share="${i}" value="${c.pct}" aria-label="Доля ${esc(c.name)}"></div><span>%</span></div>`).join("");
 updateShareSum();
}
function updateShareSum(){const sum=[...document.querySelectorAll("[data-share]")].reduce((s,x)=>s+(Number(x.value)||0),0);$("shareSum").textContent=sum+"%";$("shareSum").style.color=sum===100?"var(--mint)":"var(--red)"}
$("settingsForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget);Object.keys(data.settings).forEach(k=>data.settings[k]=Math.max(0,Number(fd.get(k))||0));save();toast("Обязательства сохранены")});
$("shares").addEventListener("input",updateShareSum);
$("saveShares").addEventListener("click",()=>{const inputs=[...document.querySelectorAll("[data-share]")],sum=inputs.reduce((s,x)=>s+(Number(x.value)||0),0);if(sum!==100){toast("Сумма долей должна быть ровно 100%");return}inputs.forEach((x,i)=>data.shares[i].pct=Number(x.value)||0);save();toast("Доли бюджета сохранены")});
$("expenseCategory").innerHTML=data.shares.map(c=>`<option>${esc(c.name)}</option>`).join("");
document.body.addEventListener("click",e=>{const edit=e.target.closest("[data-edit]");if(edit){beginEdit(edit.dataset.type,edit.dataset.edit);return}const b=e.target.closest("[data-delete]");if(!b)return;if(!confirm("Удалить эту запись?"))return;const key=b.dataset.type==="income"?"incomes":"expenses";data[key]=data[key].filter(x=>x.id!==b.dataset.delete);save();toast("Запись удалена")});
$("exportData").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="my-finance-backup-"+today()+".json";a.click();URL.revokeObjectURL(a.href)});
$("importButton").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(!d||!Array.isArray(d.incomes)||!Array.isArray(d.expenses)||!d.settings)throw Error();data={...structuredClone(DEFAULTS),...d,settings:{...DEFAULTS.settings,...d.settings}};save();renderSettings();toast("Резервная копия восстановлена")}catch(_){alert("Не удалось прочитать копию. Проверьте файл.")}e.target.value=""});
$("resetData").addEventListener("click",()=>{if(!confirm("Точно удалить все доходы, расходы и настройки? Сначала сохраните резервную копию."))return;data=structuredClone(DEFAULTS);save();renderSettings();toast("Данные очищены")});
renderSettings();render();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();