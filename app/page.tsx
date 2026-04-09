/* =========================
   1) TextInput BUNUNLA DEĞİŞTİR
   ========================= */
function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-zinc-300 bg-white px-4 py-4 text-base text-zinc-900 outline-none transition focus:border-red-500 md:py-3 md:text-sm ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    />
  );
}

/* =========================
   2) SelectInput BUNUNLA DEĞİŞTİR
   ========================= */
function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-2xl border border-zinc-300 bg-white px-4 py-4 text-base text-zinc-900 outline-none transition focus:border-red-500 md:py-3 md:text-sm ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* =========================
   3) SmallDateInput BUNUNLA DEĞİŞTİR
   ========================= */
function SmallDateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-red-500 md:h-11 md:w-[145px]"
    />
  );
}

/* =========================
   4) DataTable BUNUNLA DEĞİŞTİR
   ========================= */
function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-black/30">
      <div className="min-w-[900px]">
        <div
          className="grid border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-400"
          style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
        >
          {headers.map((header, index) => (
            <div key={header + index}>{header}</div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-500">Kayıt yok</div>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              className="grid border-b border-white/5 px-4 py-3 text-sm text-zinc-200 last:border-b-0 hover:bg-white/5"
              style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
            >
              {row.map((cell, idx) => (
                <div key={idx} className="truncate pr-2">
                  {cell}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* =========================
   5) FilterBar BUNUNLA DEĞİŞTİR
   ========================= */
function FilterBar({
  filter,
  setFilter,
  onReport,
}: {
  filter: { start: string; end: string };
  setFilter: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  onReport: () => void;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-2 md:flex md:w-auto md:flex-wrap md:items-center">
      <SmallDateInput
        value={filter.start}
        onChange={(value) => setFilter((prev) => ({ ...prev, start: value }))}
        placeholder="Başlangıç"
      />
      <SmallDateInput
        value={filter.end}
        onChange={(value) => setFilter((prev) => ({ ...prev, end: value }))}
        placeholder="Bitiş"
      />
      <button
        onClick={() => setFilter({ start: "", end: "" })}
        className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white transition hover:border-red-500/50 md:h-11"
      >
        Temizle
      </button>
      <button
        onClick={onReport}
        className="h-12 rounded-xl bg-red-600 px-4 font-medium text-white transition hover:bg-red-500 md:h-11"
      >
        Rapor al
      </button>
    </div>
  );
}

/* =========================
   6) ÜST MENÜ BLOĞUNU BUNUNLA DEĞİŞTİR
   (return içindeki en üst header kutusu)
   ========================= */

<div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/50 p-3 lg:flex-row lg:items-center">
  <div className="min-w-[240px] pl-2">
    <div className="text-xl font-black tracking-wide text-white">ORGUNLAR GARAGE</div>
    <div className="text-sm text-zinc-400">Luxury Car Service</div>
  </div>

  <div className="flex min-w-0 flex-1 flex-col gap-3 lg:ml-auto lg:items-end">
    <div className="flex w-full gap-2 overflow-x-auto pb-2 lg:justify-end">
      {tabs.map((item) => (
        <button
          key={item.key}
          onClick={() => setTab(item.key)}
          className={`shrink-0 rounded-xl px-4 py-3 text-sm transition ${
            tab === item.key
              ? "bg-white text-black"
              : "bg-transparent text-zinc-300 hover:bg-white/5"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>

    <div className="flex flex-col gap-2 sm:flex-row lg:items-center">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="text-xs text-zinc-400">Aktif kullanıcı</div>
        <div className="font-semibold">
          {session.username} / {session.role === "admin" ? "Admin" : "Personel"}
        </div>
      </div>

      <button
        onClick={logout}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-red-500/50"
      >
        <LogOut className="h-4 w-4" />
        Çıkış
      </button>
    </div>
  </div>
</div>

/* =========================
   7) MOBİLDE BÜYÜK KAYIT BUTONU İÇİN
   AŞAĞIDAKİ CLASS MANTIĞINI KULLAN
   Kayıt ekle / Güncelle butonlarında:
   ========================= */

className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm"

/* =========================
   8) FORM GRID'LERİNDE GÜVENLİ MOBİL YAPI
   Mevcut gridleri mümkün olduğunca şu mantıkta tut:
   ========================= */

className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4"

/* veya uzun formlarda */

className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-8"

/* =========================
   9) İŞ EMRİ SATIRLARINDA MOBİL İÇİN
   BUNU KULLAN
   ========================= */

className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_140px_160px_52px]"