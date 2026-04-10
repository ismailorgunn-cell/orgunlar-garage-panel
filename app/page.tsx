"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Building2,
  Car,
  ClipboardCheck,
  FileText,
  Lock,
  LogOut,
  Package,
  Pencil,
  Receipt,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

type Role = "admin" | "staff";

type MechanicRecord = {
  id: number;
  date: string;
  car: string;
  plate: string;
  service: string;
  partCost: number;
  labor: number;
  total: number;
};

type ExpertiseRecord = {
  id: number;
  date: string;
  car: string;
  plate: string;
  packageType: string;
  fee: number;
  payment: string;
};

type ExpenseRecord = {
  id: number;
  date: string;
  type: string;
  note: string;
  amount: number;
};

type Supplier = {
  id: number;
  name: string;
  phone: string;
  note: string;
};

type PartRecord = {
  id: number;
  date: string;
  part: string;
  car: string;
  plate: string;
  cost: number;
  supplierId: number;
  paid: boolean;
};

type EmployeePaymentRecord = {
  id: number;
  date: string;
  employeeName: string;
  note: string;
  amount: number;
};

type OrderJob = {
  id: number;
  item: string;
  qty: string;
  price: string;
};

type OrderForm = {
  customer: string;
  phone: string;
  date: string;
  address: string;
  car: string;
  plate: string;
  chassis: string;
  km: string;
  complaints: string;
  laborTotal: string;
  jobs: OrderJob[];
};

type WorkOrderRecord = {
  id: number;
  customer: string;
  phone: string;
  date: string;
  address: string;
  car: string;
  plate: string;
  chassis: string;
  km: string;
  complaints: string;
  laborTotal: number;
  jobs: OrderJob[];
  grandTotal: number;
  createdAt?: string;
};

type AppData = {
  mechanic: MechanicRecord[];
  expertise: ExpertiseRecord[];
  expenses: ExpenseRecord[];
  suppliers: Supplier[];
  parts: PartRecord[];
  employeePayments: EmployeePaymentRecord[];
  workOrders: WorkOrderRecord[];
  settings: {
    baseRent: number;
  };
};

const SESSION_KEY = "orgunlar-garage-session-v1";
const SETTINGS_KEY = "orgunlar-garage-settings-v1";

const USERS = {
  ismail: { username: "ismail", password: "Sma8418r", role: "admin" as Role },
  vahit: { username: "vahit", password: "Orgunlar", role: "staff" as Role },
  toprak: { username: "toprak", password: "Orgunlar", role: "staff" as Role },
};

const initialData: AppData = {
  mechanic: [],
  expertise: [],
  expenses: [],
  suppliers: [],
  parts: [],
  employeePayments: [],
  workOrders: [],
  settings: {
    baseRent: 25000,
  },
};

function uid() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function formatTRY(value: number | string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseDate(value: string) {
  if (!value) return null;
  const raw = value.trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(".").map(Number);
    return new Date(y, m - 1, d);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  return null;
}

function toDDMMYYYY(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function inRange(dateValue: string, start: string, end: string) {
  if (!start && !end) return true;

  const date = parseDate(dateValue);
  if (!date) return false;

  const time = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  const startOk =
    !startDate ||
    time >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

  const endOk =
    !endDate ||
    time <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

  return startOk && endOk;
}

function isSameMonth(dateValue: string, date: Date) {
  const parsed = parseDate(dateValue);
  if (!parsed) return false;
  return (
    parsed.getFullYear() === date.getFullYear() &&
    parsed.getMonth() === date.getMonth()
  );
}

function isWithinLastNDays(dateValue: string, days: number, today: Date) {
  const parsed = parseDate(dateValue);
  if (!parsed) return false;

  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const diffDays = Math.floor((current - target) / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays < days;
}

function pdfSafe(text: string) {
  return (text || "")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Rapor kopyalandı");
  } catch {
    window.prompt("Raporu kopyala:", text);
  }
}

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

function SectionCard({
  icon,
  title,
  desc,
  right,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/55 p-4 shadow-2xl backdrop-blur md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/30 bg-red-600/15 text-red-400">
              {icon}
            </div>
          ) : null}
          <div>
            <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
            <p className="text-sm text-zinc-400">{desc}</p>
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  subtle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtle?: string;
}) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
      <div className="rounded-3xl border border-red-500/20 bg-gradient-to-br from-zinc-950 to-red-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-400">{title}</div>
            <div className="mt-2 text-2xl font-black text-white">{value}</div>
            {subtle ? <div className="mt-1 text-xs text-zinc-500">{subtle}</div> : null}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <>
      {/* MOBİL KART GÖRÜNÜMÜ */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-zinc-500">
            Kayıt yok
          </div>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              className="rounded-3xl border border-white/10 bg-black/30 p-4"
            >
              <div className="space-y-3">
                {row.map((cell, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-[90px] text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      {headers[idx]}
                    </div>
                    <div className="flex-1 break-words text-right text-sm text-zinc-200">
                      {cell}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLO GÖRÜNÜMÜ */}
      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-black/30 md:block">
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
    </>
  );
}

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

function MiniBarChart({
  data,
}: {
  data: { label: string; income: number; expense: number }[];
}) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-bold text-white">Son 7 Gün Grafik</div>
          <div className="text-sm text-zinc-400">Gelir / gider hareketi</div>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
            Gelir
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="inline-block h-3 w-3 rounded-full bg-red-400" />
            Gider
          </div>
        </div>
      </div>

      <div className="grid h-64 grid-cols-7 items-end gap-3">
        {data.map((item) => {
          const incomeHeight = Math.max(8, (item.income / maxValue) * 180);
          const expenseHeight = Math.max(8, (item.expense / maxValue) * 180);

          return (
            <div key={item.label} className="flex flex-col items-center justify-end gap-2">
              <div className="flex h-[200px] items-end gap-1">
                <div
                  className="w-4 rounded-t-xl bg-emerald-400"
                  style={{ height: item.income > 0 ? incomeHeight : 6 }}
                  title={`Gelir: ${formatTRY(item.income)}`}
                />
                <div
                  className="w-4 rounded-t-xl bg-red-400"
                  style={{ height: item.expense > 0 ? expenseHeight : 6 }}
                  title={`Gider: ${formatTRY(item.expense)}`}
                />
              </div>
              <div className="text-xs text-zinc-400">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<AppData>(initialData);
  const [loadingData, setLoadingData] = useState(true);

  const [tab, setTab] = useState("panel");
  const [session, setSession] = useState<{ username: string; role: Role } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  const [mechanicForm, setMechanicForm] = useState({
    date: "",
    car: "",
    plate: "",
    service: "",
    partCost: "",
    labor: "",
    total: "",
  });
  const [editingMechanicId, setEditingMechanicId] = useState<number | null>(null);

  const [expertiseForm, setExpertiseForm] = useState({
    date: "",
    car: "",
    plate: "",
    packageType: "",
    fee: "",
    payment: "Nakit",
  });
  const [editingExpertiseId, setEditingExpertiseId] = useState<number | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    date: "",
    type: "",
    note: "",
    amount: "",
  });
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    note: "",
  });
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);

  const [partForm, setPartForm] = useState({
    date: "",
    part: "",
    car: "",
    plate: "",
    cost: "",
    supplierId: "",
    paid: "Hayır",
  });
  const [editingPartId, setEditingPartId] = useState<number | null>(null);

  const [employeeForm, setEmployeeForm] = useState({
    date: "",
    employeeName: "",
    note: "",
    amount: "",
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);

  const [vehicleSearchPlate, setVehicleSearchPlate] = useState("");
  const [vehicleReportStart, setVehicleReportStart] = useState("");
  const [vehicleReportEnd, setVehicleReportEnd] = useState("");

  const [orderForm, setOrderForm] = useState<OrderForm>({
    customer: "",
    phone: "",
    date: "",
    address: "",
    car: "",
    plate: "",
    chassis: "",
    km: "",
    complaints: "",
    laborTotal: "",
    jobs: [{ id: uid(), item: "", qty: "", price: "" }],
  });
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<number | null>(null);
  const [workOrderFilter, setWorkOrderFilter] = useState({ start: "", end: "" });

  const [mechanicFilter, setMechanicFilter] = useState({ start: "", end: "" });
  const [expertiseFilter, setExpertiseFilter] = useState({ start: "", end: "" });
  const [expenseFilter, setExpenseFilter] = useState({ start: "", end: "" });
  const [partsFilter, setPartsFilter] = useState({ start: "", end: "" });
  const [employeeFilter, setEmployeeFilter] = useState({ start: "", end: "" });

  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("");
  const [workOrderSearch, setWorkOrderSearch] = useState("");

  const [rentForm, setRentForm] = useState("");

  async function loadAllData() {
    setLoadingData(true);

    const [
      mechanicRes,
      expertiseRes,
      expensesRes,
      suppliersRes,
      partsRes,
      employeeRes,
      workOrdersRes,
    ] = await Promise.all([
      supabase.from("mechanic_records").select("*").order("id", { ascending: false }),
      supabase.from("expertise_records").select("*").order("id", { ascending: false }),
      supabase.from("expenses").select("*").order("id", { ascending: false }),
      supabase.from("suppliers").select("*").order("id", { ascending: false }),
      supabase.from("parts").select("*").order("id", { ascending: false }),
      supabase.from("employee_payments").select("*").order("id", { ascending: false }),
      supabase.from("work_orders").select("*").order("id", { ascending: false }),
    ]);

    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    const settings = settingsRaw ? JSON.parse(settingsRaw) : { baseRent: 25000 };

    setData({
      mechanic: (mechanicRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        car: item.car || "",
        plate: item.plate || "",
        service: item.service || "",
        partCost: Number(item.part_cost || 0),
        labor: Number(item.labor || 0),
        total: Number(item.total || 0),
      })),
      expertise: (expertiseRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        car: item.car || "",
        plate: item.plate || "",
        packageType: item.package_type || "",
        fee: Number(item.fee || 0),
        payment: item.payment || "Nakit",
      })),
      expenses: (expensesRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        type: item.type || "",
        note: item.note || "",
        amount: Number(item.amount || 0),
      })),
      suppliers: (suppliersRes.data || []).map((item) => ({
        id: Number(item.id),
        name: item.name || "",
        phone: item.phone || "",
        note: item.note || "",
      })),
      parts: (partsRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        part: item.part || "",
        car: item.car || "",
        plate: item.plate || "",
        cost: Number(item.cost || 0),
        supplierId: Number(item.supplier_id || 0),
        paid: Boolean(item.paid),
      })),
      employeePayments: (employeeRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        employeeName: item.employee_name || "",
        note: item.note || "",
        amount: Number(item.amount || 0),
      })),
      workOrders: (workOrdersRes.data || []).map((item) => ({
        id: Number(item.id),
        customer: item.customer || "",
        phone: item.phone || "",
        date: item.date || "",
        address: item.address || "",
        car: item.car || "",
        plate: item.plate || "",
        chassis: item.chassis || "",
        km: item.km || "",
        complaints: item.complaints || "",
        laborTotal: Number(item.labor_total || 0),
        jobs: Array.isArray(item.jobs)
          ? item.jobs.map((job: any) => ({
              id: Number(job.id || uid()),
              item: String(job.item || ""),
              qty: String(job.qty || ""),
              price: String(job.price || ""),
            }))
          : [],
        grandTotal: Number(item.grand_total || 0),
        createdAt: item.created_at || "",
      })),
      settings: {
        baseRent: Number(settings?.baseRent || 25000),
      },
    });

    setLoadingData(false);
  }

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch {}
    }

    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    if (settingsRaw) {
      try {
        const settings = JSON.parse(settingsRaw);
        setData((prev) => ({
          ...prev,
          settings: {
            baseRent: Number(settings?.baseRent || 25000),
          },
        }));
      } catch {}
    }

    loadAllData();
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ baseRent: Number(data.settings?.baseRent || 25000) })
    );
    setRentForm(String(data.settings?.baseRent || 0));
  }, [data.settings?.baseRent]);

  const isAdmin = session?.role === "admin";
  const canStaffAddVehicleRecords = session?.role === "admin" || session?.role === "staff";
  const canAddSharedRecords = session?.role === "admin" || session?.role === "staff";

  const supplierNameById = (id: number) =>
    data.suppliers.find((supplier) => supplier.id === id)?.name || "-";

  const mechanicRows = useMemo(
    () => (data.mechanic ?? []).filter((record) => inRange(record.date, mechanicFilter.start, mechanicFilter.end)),
    [data.mechanic, mechanicFilter]
  );

  const expertiseRows = useMemo(
    () => (data.expertise ?? []).filter((record) => inRange(record.date, expertiseFilter.start, expertiseFilter.end)),
    [data.expertise, expertiseFilter]
  );

  const expenseRows = useMemo(
    () => (data.expenses ?? []).filter((record) => inRange(record.date, expenseFilter.start, expenseFilter.end)),
    [data.expenses, expenseFilter]
  );

  const partsRows = useMemo(
    () =>
      (data.parts ?? []).filter((record) => {
        const dateOk = inRange(record.date, partsFilter.start, partsFilter.end);
        const supplierOk = selectedSupplierFilter
          ? String(record.supplierId) === selectedSupplierFilter
          : true;
        return dateOk && supplierOk;
      }),
    [data.parts, partsFilter, selectedSupplierFilter]
  );

  const employeeRows = useMemo(
    () => (data.employeePayments ?? []).filter((record) => inRange(record.date, employeeFilter.start, employeeFilter.end)),
    [data.employeePayments, employeeFilter]
  );

  const workOrderRows = useMemo(() => {
    const normalized = workOrderSearch.trim().toLowerCase();

    return (data.workOrders ?? []).filter((record) => {
      const dateOk = inRange(record.date, workOrderFilter.start, workOrderFilter.end);
      const searchOk = normalized
        ? [record.customer, record.car, record.plate, record.phone]
            .join(" ")
            .toLowerCase()
            .includes(normalized)
        : true;
      return dateOk && searchOk;
    });
  }, [data.workOrders, workOrderFilter, workOrderSearch]);

  const totalMechanic = (data.mechanic ?? []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const totalExpertise = (data.expertise ?? []).reduce((sum, item) => sum + Number(item.fee || 0), 0);
  const totalNormalExpenses = (data.expenses ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalEmployeeExpenses = (data.employeePayments ?? []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = totalNormalExpenses + totalEmployeeExpenses;
  const totalDebt = (data.parts ?? [])
    .filter((item) => !item.paid)
    .reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const totalWorkOrdersAmount = (data.workOrders ?? []).reduce(
    (sum, item) => sum + Number(item.grandTotal || 0),
    0
  );

  const totalIncome = totalMechanic + totalExpertise;
  const net = totalIncome - totalExpenses - totalDebt;
  const afterRent = net - Number(data.settings.baseRent || 0);
  const status = afterRent > 0 ? "İYİ" : afterRent === 0 ? "ORTA" : "KÖTÜ";

  const normalizedVehiclePlate = vehicleSearchPlate.trim().toLowerCase();

  const vehicleMechanicRows = useMemo(() => {
    return (data.mechanic ?? []).filter((item) => {
      const plateOk = normalizedVehiclePlate
        ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
        : true;
      const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
      return plateOk && dateOk;
    });
  }, [data.mechanic, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]);

  const vehicleExpertiseRows = useMemo(() => {
    return (data.expertise ?? []).filter((item) => {
      const plateOk = normalizedVehiclePlate
        ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
        : true;
      const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
      return plateOk && dateOk;
    });
  }, [data.expertise, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]);

  const vehiclePartsRows = useMemo(() => {
    return (data.parts ?? []).filter((item) => {
      const plateOk = normalizedVehiclePlate
        ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
        : true;
      const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
      return plateOk && dateOk;
    });
  }, [data.parts, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]);

  const vehicleWorkOrderRows = useMemo(() => {
    return (data.workOrders ?? []).filter((item) => {
      const plateOk = normalizedVehiclePlate
        ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
        : true;
      const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
      return plateOk && dateOk;
    });
  }, [data.workOrders, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]);

  const todayDate = new Date();
  const todayStr = toDDMMYYYY(todayDate);

  const todayIncome =
    (data.mechanic ?? [])
      .filter((x) => x.date === todayStr)
      .reduce((sum, x) => sum + Number(x.total || 0), 0) +
    (data.expertise ?? [])
      .filter((x) => x.date === todayStr)
      .reduce((sum, x) => sum + Number(x.fee || 0), 0);

  const todayExpense =
    (data.expenses ?? [])
      .filter((x) => x.date === todayStr)
      .reduce((sum, x) => sum + Number(x.amount || 0), 0) +
    (data.employeePayments ?? [])
      .filter((x) => x.date === todayStr)
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const weekIncome =
    (data.mechanic ?? [])
      .filter((x) => isWithinLastNDays(x.date, 7, todayDate))
      .reduce((sum, x) => sum + Number(x.total || 0), 0) +
    (data.expertise ?? [])
      .filter((x) => isWithinLastNDays(x.date, 7, todayDate))
      .reduce((sum, x) => sum + Number(x.fee || 0), 0);

  const weekExpense =
    (data.expenses ?? [])
      .filter((x) => isWithinLastNDays(x.date, 7, todayDate))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0) +
    (data.employeePayments ?? [])
      .filter((x) => isWithinLastNDays(x.date, 7, todayDate))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const monthIncome =
    (data.mechanic ?? [])
      .filter((x) => isSameMonth(x.date, todayDate))
      .reduce((sum, x) => sum + Number(x.total || 0), 0) +
    (data.expertise ?? [])
      .filter((x) => isSameMonth(x.date, todayDate))
      .reduce((sum, x) => sum + Number(x.fee || 0), 0);

  const monthExpense =
    (data.expenses ?? [])
      .filter((x) => isSameMonth(x.date, todayDate))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0) +
    (data.employeePayments ?? [])
      .filter((x) => isSameMonth(x.date, todayDate))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const monthNet = monthIncome - monthExpense;
  const unpaidParts = (data.parts ?? []).filter((x) => !x.paid);

  const topExpenseTypes = useMemo(() => {
    const map = new Map<string, number>();

    (data.expenses ?? []).forEach((item) => {
      const key = item.type || "Diğer";
      map.set(key, (map.get(key) || 0) + Number(item.amount || 0));
    });

    return Array.from(map.entries())
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [data.expenses]);

  const recentWorkOrders = useMemo(() => {
    return [...(data.workOrders ?? [])].slice(0, 5);
  }, [data.workOrders]);

  const sevenDayChartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - (6 - index));
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;
      const dateKey = toDDMMYYYY(d);

      const income =
        (data.mechanic ?? [])
          .filter((x) => x.date === dateKey)
          .reduce((sum, x) => sum + Number(x.total || 0), 0) +
        (data.expertise ?? [])
          .filter((x) => x.date === dateKey)
          .reduce((sum, x) => sum + Number(x.fee || 0), 0);

      const expense =
        (data.expenses ?? [])
          .filter((x) => x.date === dateKey)
          .reduce((sum, x) => sum + Number(x.amount || 0), 0) +
        (data.employeePayments ?? [])
          .filter((x) => x.date === dateKey)
          .reduce((sum, x) => sum + Number(x.amount || 0), 0);

      return { label, income, expense };
    });
  }, [data.mechanic, data.expertise, data.expenses, data.employeePayments]);

  const handleLogin = () => {
    const user = Object.values(USERS).find(
      (u) =>
        u.username === loginForm.username.trim().toLowerCase() &&
        u.password === loginForm.password
    );

    if (!user) {
      alert("Kullanıcı adı veya şifre yanlış");
      return;
    }

    setSession({ username: user.username, role: user.role });
    setLoginForm({ username: "", password: "" });
  };

  const logout = () => {
    setSession(null);
  };

  const updateRent = () => {
    if (!isAdmin) {
      alert("Kira düzenleme yetkisi sadece admin için açık");
      return;
    }

    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        baseRent: Number(rentForm || 0),
      },
    }));
  };

  const resetMechanicForm = () => {
    setMechanicForm({
      date: "",
      car: "",
      plate: "",
      service: "",
      partCost: "",
      labor: "",
      total: "",
    });
    setEditingMechanicId(null);
  };

  const resetExpertiseForm = () => {
    setExpertiseForm({
      date: "",
      car: "",
      plate: "",
      packageType: "",
      fee: "",
      payment: "Nakit",
    });
    setEditingExpertiseId(null);
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      date: "",
      type: "",
      note: "",
      amount: "",
    });
    setEditingExpenseId(null);
  };

  const resetSupplierForm = () => {
    setSupplierForm({
      name: "",
      phone: "",
      note: "",
    });
    setEditingSupplierId(null);
  };

  const resetPartForm = () => {
    setPartForm({
      date: "",
      part: "",
      car: "",
      plate: "",
      cost: "",
      supplierId: "",
      paid: "Hayır",
    });
    setEditingPartId(null);
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      date: "",
      employeeName: "",
      note: "",
      amount: "",
    });
    setEditingEmployeeId(null);
  };

  const resetOrderForm = () => {
    setOrderForm({
      customer: "",
      phone: "",
      date: "",
      address: "",
      car: "",
      plate: "",
      chassis: "",
      km: "",
      complaints: "",
      laborTotal: "",
      jobs: [{ id: uid(), item: "", qty: "", price: "" }],
    });
    setEditingWorkOrderId(null);
  };

  const addMechanic = async () => {
    if (!canStaffAddVehicleRecords) return;
    if (!mechanicForm.date || !mechanicForm.car || !mechanicForm.total) {
      alert("Tarih, araç ve toplam boş olamaz");
      return;
    }

    const payload = {
      date: mechanicForm.date,
      car: mechanicForm.car,
      plate: mechanicForm.plate,
      service: mechanicForm.service,
      part_cost: Number(mechanicForm.partCost || 0),
      labor: Number(mechanicForm.labor || 0),
      total: Number(mechanicForm.total || 0),
    };

    if (editingMechanicId) {
      const { error } = await supabase
        .from("mechanic_records")
        .update(payload)
        .eq("id", editingMechanicId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("mechanic_records").insert([payload]);
      if (error) {
        alert(error.message);
        return;
      }
    }

    resetMechanicForm();
    loadAllData();
  };

  const editMechanic = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }
    const item = data.mechanic.find((x) => x.id === id);
    if (!item) return;
    setEditingMechanicId(id);
    setMechanicForm({
      date: item.date,
      car: item.car,
      plate: item.plate,
      service: item.service,
      partCost: String(item.partCost),
      labor: String(item.labor),
      total: String(item.total),
    });
  };

  const deleteMechanic = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const { error } = await supabase.from("mechanic_records").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingMechanicId === id) resetMechanicForm();
    loadAllData();
  };

  const addExpertise = async () => {
    if (!canStaffAddVehicleRecords) return;
    if (!expertiseForm.date || !expertiseForm.car || !expertiseForm.fee) {
      alert("Tarih, araç ve ücret boş olamaz");
      return;
    }

    const payload = {
      date: expertiseForm.date,
      car: expertiseForm.car,
      plate: expertiseForm.plate,
      package_type: expertiseForm.packageType,
      fee: Number(expertiseForm.fee || 0),
      payment: expertiseForm.payment,
    };

    if (editingExpertiseId) {
      const { error } = await supabase
        .from("expertise_records")
        .update(payload)
        .eq("id", editingExpertiseId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("expertise_records").insert([payload]);
      if (error) {
        alert(error.message);
        return;
      }
    }

    resetExpertiseForm();
    loadAllData();
  };

  const editExpertise = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }
    const item = data.expertise.find((x) => x.id === id);
    if (!item) return;
    setEditingExpertiseId(id);
    setExpertiseForm({
      date: item.date,
      car: item.car,
      plate: item.plate,
      packageType: item.packageType,
      fee: String(item.fee),
      payment: item.payment,
    });
  };

  const deleteExpertise = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const { error } = await supabase.from("expertise_records").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingExpertiseId === id) resetExpertiseForm();
    loadAllData();
  };

  const addExpense = async () => {
    if (!canAddSharedRecords) {
      alert("Bu işlem için yetki yok");
      return;
    }

    if (!expenseForm.date || !expenseForm.type || !expenseForm.amount) {
      alert("Tarih, tür ve tutar boş olamaz");
      return;
    }

    const payload = {
      date: expenseForm.date,
      type: expenseForm.type,
      note: expenseForm.note || "",
      amount: Number(expenseForm.amount),
    };

    if (editingExpenseId) {
      const { error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editingExpenseId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("expenses").insert([payload]);
      if (error) {
        alert(error.message);
        return;
      }
    }

    resetExpenseForm();
    loadAllData();
  };

  const editExpense = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }
    const item = data.expenses.find((x) => x.id === id);
    if (!item) return;
    setEditingExpenseId(id);
    setExpenseForm({
      date: item.date,
      type: item.type,
      note: item.note,
      amount: String(item.amount),
    });
  };

  const deleteExpense = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingExpenseId === id) resetExpenseForm();
    loadAllData();
  };

  const addSupplier = async () => {
    if (!canAddSharedRecords) {
      alert("Bu işlem için yetki yok");
      return;
    }
    if (!supplierForm.name) {
      alert("Parçacı adı boş olamaz");
      return;
    }

    const payload = {
      name: supplierForm.name,
      phone: supplierForm.phone,
      note: supplierForm.note,
    };

    if (editingSupplierId) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingSupplierId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("suppliers").insert([payload]);
      if (error) {
        alert(error.message);
        return;
      }
    }

    resetSupplierForm();
    loadAllData();
  };

  const editSupplier = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }
    const item = data.suppliers.find((x) => x.id === id);
    if (!item) return;
    setEditingSupplierId(id);
    setSupplierForm({
      name: item.name,
      phone: item.phone,
      note: item.note,
    });
  };

  const deleteSupplier = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const isUsed = data.parts.some((item) => item.supplierId === id);
    if (isUsed) {
      alert("Bu parçacı parça kayıtlarında kullanılıyor.");
      return;
    }

    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingSupplierId === id) resetSupplierForm();
    loadAllData();
  };

  const addPart = async () => {
    if (!canStaffAddVehicleRecords) return;
    if (!partForm.date || !partForm.part || !partForm.cost || !partForm.supplierId) {
      alert("Tarih, parça, tutar ve parçacı boş olamaz");
      return;
    }

    const payload = {
      date: partForm.date,
      part: partForm.part,
      car: partForm.car,
      plate: partForm.plate,
      cost: Number(partForm.cost || 0),
      supplier_id: Number(partForm.supplierId),
      paid: partForm.paid === "Evet",
    };

    if (editingPartId) {
      const { error } = await supabase.from("parts").update(payload).eq("id", editingPartId);
      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("parts").insert([payload]);
      if (error) {
        alert(error.message);
        return;
      }
    }

    resetPartForm();
    loadAllData();
  };

  const editPart = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }
    const item = data.parts.find((x) => x.id === id);
    if (!item) return;
    setEditingPartId(id);
    setPartForm({
      date: item.date,
      part: item.part,
      car: item.car,
      plate: item.plate,
      cost: String(item.cost),
      supplierId: String(item.supplierId),
      paid: item.paid ? "Evet" : "Hayır",
    });
  };

  const deletePart = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingPartId === id) resetPartForm();
    loadAllData();
  };

  const addEmployeePayment = async () => {
    if (!canAddSharedRecords) {
      alert("Bu işlem için yetki yok");
      return;
    }
    if (!employeeForm.date || !employeeForm.employeeName || !employeeForm.amount) {
      alert("Tarih, eleman adı ve tutar boş olamaz");
      return;
    }

    const payload = {
      date: employeeForm.date,
      employee_name: employeeForm.employeeName,
      note: employeeForm.note,
      amount: Number(employeeForm.amount || 0),
    };

    if (editingEmployeeId) {
      const { error } = await supabase
        .from("employee_payments")
        .update(payload)
        .eq("id", editingEmployeeId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("employee_payments").insert([payload]);
      if (error) {
        alert(error.message);
        return;
      }
    }

    resetEmployeeForm();
    loadAllData();
  };

  const editEmployeePayment = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }
    const item = data.employeePayments.find((x) => x.id === id);
    if (!item) return;
    setEditingEmployeeId(id);
    setEmployeeForm({
      date: item.date,
      employeeName: item.employeeName,
      note: item.note,
      amount: String(item.amount),
    });
  };

  const deleteEmployeePayment = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const { error } = await supabase.from("employee_payments").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingEmployeeId === id) resetEmployeeForm();
    loadAllData();
  };

  const saveWorkOrder = async () => {
    if (!canAddSharedRecords) {
      alert("Bu işlem için yetki yok");
      return;
    }

    if (!orderForm.customer || !orderForm.date || !orderForm.car || !orderForm.plate) {
      alert("Müşteri, tarih, araç ve plaka boş olamaz");
      return;
    }

    const cleanedJobs = orderForm.jobs.filter(
      (job) => job.item.trim() || job.qty.trim() || job.price.trim()
    );

    const payload = {
      customer: orderForm.customer,
      phone: orderForm.phone,
      date: orderForm.date,
      address: orderForm.address,
      car: orderForm.car,
      plate: orderForm.plate,
      chassis: orderForm.chassis,
      km: orderForm.km,
      complaints: orderForm.complaints,
      labor_total: Number(orderForm.laborTotal || 0),
      jobs: cleanedJobs.map((job) => ({
        id: job.id,
        item: job.item,
        qty: job.qty,
        price: job.price,
      })),
      grand_total:
        cleanedJobs.reduce((sum, item) => sum + Number(item.price || 0), 0) +
        Number(orderForm.laborTotal || 0),
    };

    if (editingWorkOrderId) {
      const { error } = await supabase
        .from("work_orders")
        .update(payload)
        .eq("id", editingWorkOrderId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("work_orders").insert([payload]);

      if (error) {
        alert(error.message);
        return;
      }
    }

    resetOrderForm();
    loadAllData();
    alert("İş emri kaydedildi");
  };

  const editWorkOrder = (id: number) => {
    if (!isAdmin) {
      alert("Düzenleme yetkisi sadece admin için açık");
      return;
    }

    const item = data.workOrders.find((x) => x.id === id);
    if (!item) return;

    setEditingWorkOrderId(id);
    setOrderForm({
      customer: item.customer,
      phone: item.phone,
      date: item.date,
      address: item.address,
      car: item.car,
      plate: item.plate,
      chassis: item.chassis,
      km: item.km,
      complaints: item.complaints,
      laborTotal: String(item.laborTotal || 0),
      jobs:
        item.jobs && item.jobs.length > 0
          ? item.jobs.map((job) => ({
              id: Number(job.id || uid()),
              item: String(job.item || ""),
              qty: String(job.qty || ""),
              price: String(job.price || ""),
            }))
          : [{ id: uid(), item: "", qty: "", price: "" }],
    });

    setTab("order");
  };

  const deleteWorkOrder = async (id: number) => {
    if (!isAdmin) {
      alert("Silme yetkisi sadece admin için açık");
      return;
    }

    const { error } = await supabase.from("work_orders").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (editingWorkOrderId === id) resetOrderForm();
    loadAllData();
  };

  const buildMechanicReport = () => {
    const total = mechanicRows.reduce((sum, item) => sum + Number(item.total || 0), 0);
    copyText(
      `MEKANIK RAPOR
Tarih: ${mechanicFilter.start || "-"} / ${mechanicFilter.end || "-"}
Kayit: ${mechanicRows.length}
Toplam Gelir: ${formatTRY(total)}`
    );
  };

  const buildExpertiseReport = () => {
    const total = expertiseRows.reduce((sum, item) => sum + Number(item.fee || 0), 0);
    copyText(
      `EKSPERTIZ RAPOR
Tarih: ${expertiseFilter.start || "-"} / ${expertiseFilter.end || "-"}
Kayit: ${expertiseRows.length}
Toplam Gelir: ${formatTRY(total)}`
    );
  };

  const buildExpenseReport = () => {
    const total = expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    copyText(
      `GIDER RAPOR
Tarih: ${expenseFilter.start || "-"} / ${expenseFilter.end || "-"}
Kayit: ${expenseRows.length}
Toplam Gider: ${formatTRY(total)}`
    );
  };

  const buildPartsReport = () => {
    const total = partsRows.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    copyText(
      `PARCA RAPOR
Tarih: ${partsFilter.start || "-"} / ${partsFilter.end || "-"}
Kayit: ${partsRows.length}
Toplam Parca: ${formatTRY(total)}`
    );
  };

  const buildEmployeeReport = () => {
    const total = employeeRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    copyText(
      `ELEMAN ODEMELERI RAPORU
Tarih: ${employeeFilter.start || "-"} / ${employeeFilter.end || "-"}
Kayit: ${employeeRows.length}
Toplam Odeme: ${formatTRY(total)}`
    );
  };

  const buildVehicleReport = () => {
    const mechIncome = vehicleMechanicRows.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const mechPart = vehicleMechanicRows.reduce((sum, item) => sum + Number(item.partCost || 0), 0);
    const expIncome = vehicleExpertiseRows.reduce((sum, item) => sum + Number(item.fee || 0), 0);
    const partCost = vehiclePartsRows.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const workOrderTotal = vehicleWorkOrderRows.reduce(
      (sum, item) => sum + Number(item.grandTotal || 0),
      0
    );

    copyText(
      `ARAC TAKIP RAPORU
Plaka: ${vehicleSearchPlate || "-"}
Tarih: ${vehicleReportStart || "-"} / ${vehicleReportEnd || "-"}
Mekanik Kayit: ${vehicleMechanicRows.length}
Ekspertiz Kayit: ${vehicleExpertiseRows.length}
Parca Kayit: ${vehiclePartsRows.length}
Is Emri Kayit: ${vehicleWorkOrderRows.length}
Mekanik Gelir: ${formatTRY(mechIncome)}
Mekanik Parca Maliyeti: ${formatTRY(mechPart)}
Ekspertiz Geliri: ${formatTRY(expIncome)}
Parca Tutari: ${formatTRY(partCost)}
Is Emri Toplami: ${formatTRY(workOrderTotal)}`
    );
  };

  const buildWorkOrderReport = () => {
    const total = workOrderRows.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
    copyText(
      `IS EMRI RAPORU
Tarih: ${workOrderFilter.start || "-"} / ${workOrderFilter.end || "-"}
Kayit: ${workOrderRows.length}
Toplam Tutar: ${formatTRY(total)}`
    );
  };

  const addOrderJob = () => {
    setOrderForm((prev) => ({
      ...prev,
      jobs: [...prev.jobs, { id: uid(), item: "", qty: "", price: "" }],
    }));
  };

  const updateOrderJob = (id: number, field: keyof OrderJob, value: string) => {
    setOrderForm((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) => (job.id === id ? { ...job, [field]: value } : job)),
    }));
  };

  const removeOrderJob = (id: number) => {
    setOrderForm((prev) => ({
      ...prev,
      jobs:
        prev.jobs.length > 1
          ? prev.jobs.filter((job) => job.id !== id)
          : [{ id: uid(), item: "", qty: "", price: "" }],
    }));
  };

  const orderPartsTotal = orderForm.jobs.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const orderLaborTotal = Number(orderForm.laborTotal || 0);
  const orderGrandTotal = orderPartsTotal + orderLaborTotal;

  const generateOrderPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, "F");
    doc.setDrawColor(180, 20, 20);
    doc.setTextColor(20, 20, 20);

    doc.setFontSize(24);
    doc.text("ORGUNLAR GARAGE", 105, 18, { align: "center" });

    doc.setTextColor(180, 20, 20);
    doc.setFontSize(16);
    doc.text("ARAC IS EMRI FORMU", 105, 28, { align: "center" });

    doc.roundedRect(12, 36, 88, 38, 3, 3);
    doc.roundedRect(110, 36, 88, 38, 3, 3);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    doc.text("MUSTERI BILGILERI", 16, 44);
    doc.text("ARAC BILGILERI", 114, 44);

    doc.setFontSize(10);
    doc.text(`Musteri : ${pdfSafe(orderForm.customer) || "-"}`, 16, 52);
    doc.text(`Telefon : ${pdfSafe(orderForm.phone) || "-"}`, 16, 59);
    doc.text(`Tarih   : ${pdfSafe(orderForm.date) || "-"}`, 16, 66);
    doc.text(`Adres   : ${pdfSafe(orderForm.address) || "-"}`, 16, 73);

    doc.text(`Arac    : ${pdfSafe(orderForm.car) || "-"}`, 114, 52);
    doc.text(`Plaka   : ${pdfSafe(orderForm.plate) || "-"}`, 114, 59);
    doc.text(`Sasi No : ${pdfSafe(orderForm.chassis) || "-"}`, 114, 66);
    doc.text(`KM      : ${pdfSafe(orderForm.km) || "-"}`, 114, 73);

    doc.roundedRect(12, 82, 186, 42, 3, 3);
    doc.setFontSize(11);
    doc.text("MUSTERI SIKAYETLERI", 105, 90, { align: "center" });

    const complaintLines = doc.splitTextToSize(pdfSafe(orderForm.complaints || "-"), 174);
    doc.setFontSize(10);
    doc.text(complaintLines, 16, 99);

    doc.roundedRect(12, 130, 186, 100, 3, 3);
    doc.setFontSize(11);
    doc.text("YAPILAN ISLEMLER", 105, 138, { align: "center" });

    doc.line(16, 145, 194, 145);
    doc.text("NO", 18, 151);
    doc.text("ISLEM", 36, 151);
    doc.text("ADET", 146, 151);
    doc.text("FIYAT", 170, 151);

    let y = 160;
    orderForm.jobs.slice(0, 7).forEach((job, i) => {
      doc.text(String(i + 1), 18, y);
      doc.text(pdfSafe(job.item || "-"), 36, y);
      doc.text(pdfSafe(job.qty || "-"), 148, y);
      doc.text(job.price ? `${pdfSafe(job.price)} TL` : "-", 168, y);
      doc.line(16, y + 3, 194, y + 3);
      y += 10;
    });

    doc.roundedRect(118, 236, 80, 24, 3, 3);
    doc.setFontSize(10);
    doc.text("Iscilik", 123, 245);
    doc.text(formatTRY(orderLaborTotal), 193, 245, { align: "right" });
    doc.text("Genel Toplam", 123, 255);
    doc.text(formatTRY(orderGrandTotal), 193, 255, { align: "right" });

    doc.text("Yetkili : Ismail Orgun / Vahit Orgun", 16, 270);
    doc.text("ORGUNLAR GARAGE", 105, 284, { align: "center" });

    doc.save("orgunlar-is-emri.pdf");
  };

  const tabs = [
    { key: "panel", label: "Panel" },
    { key: "mechanic", label: "Mekanik" },
    { key: "expertise", label: "Ekspertiz" },
    { key: "expenses", label: "Gider" },
    { key: "employees", label: "Eleman Ödemeleri" },
    { key: "suppliers", label: "Parçacılar" },
    { key: "parts", label: "Parça" },
    { key: "vehicle", label: "Araç Takip" },
    { key: "order", label: "İş Emri" },
  ];

  if (!session) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(180,20,20,0.20),transparent_20%),linear-gradient(135deg,#050505_0%,#111217_45%,#2b0909_100%)] px-4 py-8 text-white md:px-8">
        <div className="mx-auto flex min-h-[90vh] max-w-7xl items-center justify-center">
          <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
            <div className="rounded-[32px] border border-red-500/20 bg-gradient-to-r from-black via-zinc-950 to-red-950 p-8 shadow-2xl">
              <div className="mb-3 inline-flex rounded-full border border-red-500/20 bg-red-600/15 px-3 py-1 text-xs text-red-400">
                ORGUNLAR GARAGE
              </div>
              <h1 className="text-4xl font-black tracking-tight">Finans & Operasyon Yönetim Paneli</h1>
              <p className="mt-4 text-zinc-400">Giriş yapıp sisteme devam et.</p>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-black/55 p-8 shadow-2xl backdrop-blur">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-600/15 text-red-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Giriş Yap</h2>
                  <p className="text-sm text-zinc-400">Kullanıcı adı ve şifreni gir</p>
                </div>
              </div>

              <div className="space-y-4">
                <TextInput
                  value={loginForm.username}
                  onChange={(value) => setLoginForm((prev) => ({ ...prev, username: value }))}
                  placeholder="Kullanıcı adı"
                />
                <TextInput
                  value={loginForm.password}
                  onChange={(value) => setLoginForm((prev) => ({ ...prev, password: value }))}
                  placeholder="Şifre"
                  type="password"
                />
                <button
                  onClick={handleLogin}
                  className="w-full rounded-2xl bg-red-600 px-5 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm"
                >
                  Giriş yap
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(180,20,20,0.20),transparent_20%),linear-gradient(135deg,#050505_0%,#111217_45%,#2b0909_100%)] px-4 py-8 text-white md:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-black/55 px-6 py-4 text-white">
            Veriler yükleniyor...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(180,20,20,0.20),transparent_20%),linear-gradient(135deg,#050505_0%,#111217_45%,#2b0909_100%)] px-4 py-5 text-white md:px-8">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
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

        {tab === "panel" && (
          <>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <div className="overflow-hidden rounded-[32px] border border-red-500/20 bg-gradient-to-r from-black via-zinc-950 to-red-950 shadow-2xl">
                <div className="p-6 md:p-8">
                  <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
                    <div className="max-w-3xl">
                      <div className="mb-3 inline-flex rounded-full border border-red-500/20 bg-red-600/15 px-3 py-1 text-xs text-red-400">
                        ORGUNLAR GARAGE
                      </div>
                      <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                        Finans & Operasyon Yönetim Paneli
                      </h1>
                      <p className="mt-2 text-zinc-400">
                        Gelir, gider, eleman ödemeleri, parçacı, parça, araç takip, iş emri ve profesyonel dashboard
                      </p>
                    </div>

                    <div className="min-w-[280px] rounded-3xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Genel Durum</span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            status === "İYİ"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : status === "ORTA"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="mt-4 text-2xl font-black">{formatTRY(afterRent)}</div>
                      <div className="mt-1 text-xs text-zinc-500">Kira sonrası durum</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Toplam Gelir" value={formatTRY(totalIncome)} icon={<Wallet className="h-5 w-5" />} />
              <StatCard title="Toplam Gider" value={formatTRY(totalExpenses)} icon={<TrendingDown className="h-5 w-5" />} />
              <StatCard title="Parça Borcu" value={formatTRY(totalDebt)} icon={<Package className="h-5 w-5" />} />
              <StatCard title="Net Durum" value={formatTRY(net)} icon={<TrendingUp className="h-5 w-5" />} />
              <StatCard title="Bugün Gelir" value={formatTRY(todayIncome)} icon={<TrendingUp className="h-5 w-5" />} subtle={todayStr} />
              <StatCard title="Bugün Gider" value={formatTRY(todayExpense)} icon={<TrendingDown className="h-5 w-5" />} subtle={todayStr} />
              <StatCard title="Bu Hafta Net" value={formatTRY(weekIncome - weekExpense)} icon={<BarChart3 className="h-5 w-5" />} subtle="Son 7 gün" />
              <StatCard title="Bu Ay Net" value={formatTRY(monthNet)} icon={<BadgeDollarSign className="h-5 w-5" />} subtle="Aylık durum" />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <MiniBarChart data={sevenDayChartData} />
              </div>

              <SectionCard icon={<Package className="h-5 w-5" />} title="Hızlı Özet" desc="Canlı özet kutuları">
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-sm text-zinc-400">Ödenmemiş parça</div>
                    <div className="mt-1 text-xl font-black text-white">{unpaidParts.length} adet</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-sm text-zinc-400">Toplam iş emri tutarı</div>
                    <div className="mt-1 text-xl font-black text-white">{formatTRY(totalWorkOrdersAmount)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-sm text-zinc-400">Bu hafta gelir</div>
                    <div className="mt-1 text-xl font-black text-white">{formatTRY(weekIncome)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-sm text-zinc-400">Bu hafta gider</div>
                    <div className="mt-1 text-xl font-black text-white">{formatTRY(weekExpense)}</div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard icon={<AlertTriangle className="h-5 w-5" />} title="Özet" desc="Genel durum">
                <DataTable
                  headers={["Kalem", "Tutar"]}
                  rows={[
                    ["Mekanik gelir", formatTRY(totalMechanic)],
                    ["Ekspertiz gelir", formatTRY(totalExpertise)],
                    ["Normal gider", formatTRY(totalNormalExpenses)],
                    ["Eleman ödemeleri", formatTRY(totalEmployeeExpenses)],
                    ["Toplam gider", formatTRY(totalExpenses)],
                    ["Parça borcu", formatTRY(totalDebt)],
                    ["İş emri toplamı", formatTRY(totalWorkOrdersAmount)],
                    ["Net", formatTRY(net)],
                    ["Kira sonrası", formatTRY(afterRent)],
                  ]}
                />
              </SectionCard>

              <SectionCard icon={<Building2 className="h-5 w-5" />} title="Durum Analizi" desc="Masraf, kira ve yorum">
                <div className="space-y-4">
                  <div
                    className={`rounded-3xl border p-5 ${
                      afterRent >= 0
                        ? "border-emerald-500/20 bg-emerald-500/10"
                        : "border-red-500/20 bg-red-500/10"
                    }`}
                  >
                    <div className="text-2xl font-black">
                      {afterRent >= 0 ? "İyi durumdasın" : "Masraf baskısı yüksek"}
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">
                      {afterRent >= 0
                        ? "Kira çıktıktan sonra para kalıyor."
                        : "Gelir artırmak veya gider azaltmak gerekiyor."}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 text-sm text-zinc-400">Aylık Kira</div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="number"
                        value={rentForm}
                        disabled={!isAdmin}
                        onChange={(e) => setRentForm(e.target.value)}
                        placeholder="Kira tutarı"
                        className={`w-full rounded-2xl border border-zinc-300 bg-white px-4 py-4 text-base text-zinc-900 outline-none transition focus:border-red-500 md:py-3 md:text-sm ${
                          !isAdmin ? "cursor-not-allowed opacity-60" : ""
                        }`}
                      />
                      <button
                        onClick={updateRent}
                        className={`rounded-2xl px-4 py-4 text-base font-medium text-white transition md:py-3 md:text-sm ${
                          isAdmin ? "bg-red-600 hover:bg-red-500" : "cursor-not-allowed bg-zinc-700"
                        }`}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 text-sm text-zinc-400">En çok gider kalemleri</div>
                    <div className="space-y-2">
                      {topExpenseTypes.length === 0 ? (
                        <div className="text-sm text-zinc-500">Henüz gider kaydı yok</div>
                      ) : (
                        topExpenseTypes.map((item) => (
                          <div
                            key={item.type}
                            className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-3 py-3"
                          >
                            <span className="text-zinc-200">{item.type}</span>
                            <span className="font-semibold text-white">{formatTRY(item.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard icon={<FileText className="h-5 w-5" />} title="Son İş Emirleri" desc="En son açılan kayıtlar">
              <DataTable
                headers={["Tarih", "Müşteri", "Araç", "Plaka", "Toplam"]}
                rows={recentWorkOrders.map((item) => [
                  item.date,
                  item.customer,
                  item.car,
                  item.plate,
                  formatTRY(item.grandTotal),
                ])}
              />
            </SectionCard>
          </>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "mechanic" && (
              <SectionCard
                icon={<Wrench className="h-5 w-5" />}
                title="Mekanik"
                desc="Araç işlem kayıtları"
                right={<FilterBar filter={mechanicFilter} setFilter={setMechanicFilter} onReport={buildMechanicReport} />}
              >
                <div className="mb-4 text-xs text-zinc-400">
                  {isAdmin ? "Admin: ekleme, düzenleme, silme açık." : "Personel: sadece kayıt ekleme açık."}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 md:hidden">
                  <button
                    onClick={() =>
                      setMechanicForm((prev) => ({
                        ...prev,
                        date: toDDMMYYYY(new Date()),
                      }))
                    }
                    className="rounded-xl bg-zinc-800 py-3 text-white"
                  >
                    Bugün
                  </button>
                  <button
                    onClick={resetMechanicForm}
                    className="rounded-xl bg-red-600 py-3 text-white"
                  >
                    Temizle
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
                  <TextInput value={mechanicForm.date} onChange={(value) => setMechanicForm({ ...mechanicForm, date: value })} placeholder="Tarih gg.aa.yyyy" />
                  <TextInput value={mechanicForm.car} onChange={(value) => setMechanicForm({ ...mechanicForm, car: value })} placeholder="Araç" />
                  <TextInput value={mechanicForm.plate} onChange={(value) => setMechanicForm({ ...mechanicForm, plate: value })} placeholder="Plaka" />
                  <TextInput value={mechanicForm.service} onChange={(value) => setMechanicForm({ ...mechanicForm, service: value })} placeholder="İşlem" />
                  <TextInput value={mechanicForm.partCost} onChange={(value) => setMechanicForm({ ...mechanicForm, partCost: value })} placeholder="Parça maliyeti" />
                  <TextInput value={mechanicForm.labor} onChange={(value) => setMechanicForm({ ...mechanicForm, labor: value })} placeholder="İşçilik" />
                  <TextInput value={mechanicForm.total} onChange={(value) => setMechanicForm({ ...mechanicForm, total: value })} placeholder="Toplam" />
                  <div className="flex flex-col gap-2 md:flex-row">
                    <button
                      onClick={addMechanic}
                      className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm"
                    >
                      {editingMechanicId ? "Güncelle" : "Kayıt ekle"}
                    </button>
                    {editingMechanicId && isAdmin ? (
                      <button onClick={resetMechanicForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <DataTable
                    headers={["Tarih", "Araç", "Plaka", "İşlem", "Parça", "İşçilik", "Toplam", "İşlem"]}
                    rows={mechanicRows.map((item) => [
                      item.date,
                      item.car,
                      item.plate,
                      item.service,
                      formatTRY(item.partCost),
                      formatTRY(item.labor),
                      formatTRY(item.total),
                      <div key={item.id} className="flex gap-2">
                        <button
                          onClick={() => editMechanic(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMechanic(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </div>
              </SectionCard>
            )}

            {tab === "expertise" && (
              <SectionCard
                icon={<ClipboardCheck className="h-5 w-5" />}
                title="Ekspertiz"
                desc="Ekspertiz kayıtları"
                right={<FilterBar filter={expertiseFilter} setFilter={setExpertiseFilter} onReport={buildExpertiseReport} />}
              >
                <div className="mb-4 text-xs text-zinc-400">
                  {isAdmin ? "Admin: ekleme, düzenleme, silme açık." : "Personel: sadece kayıt ekleme açık."}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
                  <TextInput value={expertiseForm.date} onChange={(value) => setExpertiseForm({ ...expertiseForm, date: value })} placeholder="Tarih gg.aa.yyyy" />
                  <TextInput value={expertiseForm.car} onChange={(value) => setExpertiseForm({ ...expertiseForm, car: value })} placeholder="Araç" />
                  <TextInput value={expertiseForm.plate} onChange={(value) => setExpertiseForm({ ...expertiseForm, plate: value })} placeholder="Plaka" />
                  <TextInput value={expertiseForm.packageType} onChange={(value) => setExpertiseForm({ ...expertiseForm, packageType: value })} placeholder="Paket" />
                  <TextInput value={expertiseForm.fee} onChange={(value) => setExpertiseForm({ ...expertiseForm, fee: value })} placeholder="Ücret" />
                  <SelectInput
                    value={expertiseForm.payment}
                    onChange={(value) => setExpertiseForm({ ...expertiseForm, payment: value })}
                    placeholder="Ödeme seç"
                    options={[
                      { label: "Nakit", value: "Nakit" },
                      { label: "Kart", value: "Kart" },
                      { label: "Havale", value: "Havale" },
                    ]}
                  />
                  <div className="flex flex-col gap-2 xl:col-span-2 md:flex-row">
                    <button
                      onClick={addExpertise}
                      className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm"
                    >
                      {editingExpertiseId ? "Güncelle" : "Kayıt ekle"}
                    </button>
                    {editingExpertiseId && isAdmin ? (
                      <button onClick={resetExpertiseForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <DataTable
                    headers={["Tarih", "Araç", "Plaka", "Paket", "Ücret", "Ödeme", "İşlem"]}
                    rows={expertiseRows.map((item) => [
                      item.date,
                      item.car,
                      item.plate,
                      item.packageType,
                      formatTRY(item.fee),
                      item.payment,
                      <div key={item.id} className="flex gap-2">
                        <button
                          onClick={() => editExpertise(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteExpertise(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </div>
              </SectionCard>
            )}

            {tab === "expenses" && (
              <SectionCard
                icon={<Receipt className="h-5 w-5" />}
                title="Gider"
                desc="Gider kayıtları"
                right={<FilterBar filter={expenseFilter} setFilter={setExpenseFilter} onReport={buildExpenseReport} />}
              >
                <div className="mb-4 text-xs text-zinc-400">
                  {isAdmin
                    ? "Admin: ekleme, düzenleme, silme açık."
                    : "Personel: kayıt ekleyebilir, düzenleme ve silme yapamaz."}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <TextInput disabled={!canAddSharedRecords} value={expenseForm.date} onChange={(value) => setExpenseForm({ ...expenseForm, date: value })} placeholder="Tarih gg.aa.yyyy" />
                  <TextInput disabled={!canAddSharedRecords} value={expenseForm.type} onChange={(value) => setExpenseForm({ ...expenseForm, type: value })} placeholder="Tür" />
                  <TextInput disabled={!canAddSharedRecords} value={expenseForm.note} onChange={(value) => setExpenseForm({ ...expenseForm, note: value })} placeholder="Açıklama" />
                  <TextInput disabled={!canAddSharedRecords} value={expenseForm.amount} onChange={(value) => setExpenseForm({ ...expenseForm, amount: value })} placeholder="Tutar" />
                  <div className="flex flex-col gap-2 md:flex-row">
                    <button
                      onClick={addExpense}
                      className={`w-full rounded-2xl px-4 py-4 text-base font-medium text-white transition md:py-3 md:text-sm ${
                        canAddSharedRecords ? "bg-red-600 hover:bg-red-500" : "cursor-not-allowed bg-zinc-700"
                      }`}
                    >
                      {editingExpenseId ? "Güncelle" : "Gider ekle"}
                    </button>
                    {editingExpenseId && isAdmin ? (
                      <button onClick={resetExpenseForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <DataTable
                    headers={["Tarih", "Tür", "Açıklama", "Tutar", "İşlem"]}
                    rows={data.expenses.map((item) => [
                      item.date,
                      item.type,
                      item.note,
                      formatTRY(item.amount),
                      <div key={item.id} className="flex gap-2">
                        <button
                          onClick={() => editExpense(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteExpense(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </div>
              </SectionCard>
            )}

            {tab === "employees" && (
              <SectionCard
                icon={<BadgeDollarSign className="h-5 w-5" />}
                title="Eleman Ödemeleri"
                desc="Maaş ve personel ödeme kayıtları"
                right={<FilterBar filter={employeeFilter} setFilter={setEmployeeFilter} onReport={buildEmployeeReport} />}
              >
                <div className="mb-4 text-xs text-zinc-400">
                  {isAdmin
                    ? "Admin: ekleme, düzenleme, silme açık."
                    : "Personel: kayıt ekleyebilir, düzenleme ve silme yapamaz."}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <TextInput disabled={!canAddSharedRecords} value={employeeForm.date} onChange={(value) => setEmployeeForm({ ...employeeForm, date: value })} placeholder="Tarih gg.aa.yyyy" />
                  <TextInput disabled={!canAddSharedRecords} value={employeeForm.employeeName} onChange={(value) => setEmployeeForm({ ...employeeForm, employeeName: value })} placeholder="Eleman adı" />
                  <TextInput disabled={!canAddSharedRecords} value={employeeForm.note} onChange={(value) => setEmployeeForm({ ...employeeForm, note: value })} placeholder="Açıklama" />
                  <TextInput disabled={!canAddSharedRecords} value={employeeForm.amount} onChange={(value) => setEmployeeForm({ ...employeeForm, amount: value })} placeholder="Tutar" />
                  <div className="flex flex-col gap-2 md:flex-row">
                    <button
                      onClick={addEmployeePayment}
                      className={`w-full rounded-2xl px-4 py-4 text-base font-medium text-white transition md:py-3 md:text-sm ${
                        canAddSharedRecords ? "bg-red-600 hover:bg-red-500" : "cursor-not-allowed bg-zinc-700"
                      }`}
                    >
                      {editingEmployeeId ? "Güncelle" : "Ödeme ekle"}
                    </button>
                    {editingEmployeeId && isAdmin ? (
                      <button onClick={resetEmployeeForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <DataTable
                    headers={["Tarih", "Eleman", "Açıklama", "Tutar", "İşlem"]}
                    rows={employeeRows.map((item) => [
                      item.date,
                      item.employeeName,
                      item.note || "-",
                      formatTRY(item.amount),
                      <div key={item.id} className="flex gap-2">
                        <button
                          onClick={() => editEmployeePayment(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteEmployeePayment(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </div>
              </SectionCard>
            )}

            {tab === "suppliers" && (
              <SectionCard icon={<Users className="h-5 w-5" />} title="Parçacılar" desc="Parçacı ekleme ve listeleme">
                <div className="mb-4 text-xs text-zinc-400">
                  {isAdmin
                    ? "Admin: ekleme, düzenleme, silme açık."
                    : "Personel: kayıt ekleyebilir, düzenleme ve silme yapamaz."}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <TextInput disabled={!canAddSharedRecords} value={supplierForm.name} onChange={(value) => setSupplierForm({ ...supplierForm, name: value })} placeholder="Parçacı adı" />
                  <TextInput disabled={!canAddSharedRecords} value={supplierForm.phone} onChange={(value) => setSupplierForm({ ...supplierForm, phone: value })} placeholder="Telefon" />
                  <TextInput disabled={!canAddSharedRecords} value={supplierForm.note} onChange={(value) => setSupplierForm({ ...supplierForm, note: value })} placeholder="Not" />
                  <div className="flex flex-col gap-2 md:col-span-2 md:flex-row">
                    <button
                      onClick={addSupplier}
                      className={`w-full rounded-2xl px-4 py-4 text-base font-medium text-white transition md:py-3 md:text-sm ${
                        canAddSharedRecords ? "bg-red-600 hover:bg-red-500" : "cursor-not-allowed bg-zinc-700"
                      }`}
                    >
                      {editingSupplierId ? "Güncelle" : "Parçacı ekle"}
                    </button>
                    {editingSupplierId && isAdmin ? (
                      <button onClick={resetSupplierForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <DataTable
                    headers={["Parçacı", "Telefon", "Not", "İşlem"]}
                    rows={data.suppliers.map((supplier) => [
                      supplier.name,
                      supplier.phone || "-",
                      supplier.note || "-",
                      <div key={supplier.id} className="flex gap-2">
                        <button
                          onClick={() => editSupplier(supplier.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteSupplier(supplier.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </div>
              </SectionCard>
            )}

            {tab === "parts" && (
              <SectionCard
                icon={<Package className="h-5 w-5" />}
                title="Parça"
                desc="Parça kayıtları ve parçacı filtresi"
                right={<FilterBar filter={partsFilter} setFilter={setPartsFilter} onReport={buildPartsReport} />}
              >
                <div className="mb-4 text-xs text-zinc-400">
                  {isAdmin ? "Admin: ekleme, düzenleme, silme açık." : "Personel: sadece parça ekleme açık."}
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SelectInput
                    value={selectedSupplierFilter}
                    onChange={setSelectedSupplierFilter}
                    placeholder="Parçacı filtrele"
                    options={[
                      { label: "Tümü", value: "" },
                      ...data.suppliers.map((supplier) => ({
                        label: supplier.name,
                        value: String(supplier.id),
                      })),
                    ]}
                  />
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                    Filtre sonucu: <span className="font-semibold text-white">{partsRows.length}</span> kayıt
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                    Toplam:{" "}
                    <span className="font-semibold text-white">
                      {formatTRY(partsRows.reduce((sum, item) => sum + Number(item.cost || 0), 0))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
                  <TextInput value={partForm.date} onChange={(value) => setPartForm({ ...partForm, date: value })} placeholder="Tarih gg.aa.yyyy" />
                  <TextInput value={partForm.part} onChange={(value) => setPartForm({ ...partForm, part: value })} placeholder="Parça" />
                  <TextInput value={partForm.car} onChange={(value) => setPartForm({ ...partForm, car: value })} placeholder="Araç" />
                  <TextInput value={partForm.plate} onChange={(value) => setPartForm({ ...partForm, plate: value })} placeholder="Plaka" />
                  <TextInput value={partForm.cost} onChange={(value) => setPartForm({ ...partForm, cost: value })} placeholder="Tutar" />
                  <SelectInput
                    value={partForm.supplierId}
                    onChange={(value) => setPartForm({ ...partForm, supplierId: value })}
                    placeholder="Parçacı seç"
                    options={data.suppliers.map((supplier) => ({
                      label: supplier.name,
                      value: String(supplier.id),
                    }))}
                  />
                  <SelectInput
                    value={partForm.paid}
                    onChange={(value) => setPartForm({ ...partForm, paid: value })}
                    placeholder="Ödeme durumu"
                    options={[
                      { label: "Hayır", value: "Hayır" },
                      { label: "Evet", value: "Evet" },
                    ]}
                  />
                  <div className="flex flex-col gap-2 md:flex-row">
                    <button
                      onClick={addPart}
                      className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm"
                    >
                      {editingPartId ? "Güncelle" : "Parça ekle"}
                    </button>
                    {editingPartId && isAdmin ? (
                      <button onClick={resetPartForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                        İptal
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6">
                  <DataTable
                    headers={["Tarih", "Parça", "Araç", "Plaka", "Parçacı", "Tutar", "Durum", "İşlem"]}
                    rows={partsRows.map((item) => [
                      item.date,
                      item.part,
                      item.car,
                      item.plate || "-",
                      supplierNameById(item.supplierId),
                      formatTRY(item.cost),
                      item.paid ? "Ödendi" : "Borçta",
                      <div key={item.id} className="flex gap-2">
                        <button
                          onClick={() => editPart(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deletePart(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </div>
              </SectionCard>
            )}

            {tab === "vehicle" && (
              <SectionCard
                icon={<Car className="h-5 w-5" />}
                title="Araç Takip"
                desc="Plakaya göre tüm geçmiş"
                right={
                  <div className="grid w-full grid-cols-1 gap-2 md:flex md:w-auto md:flex-wrap md:items-center">
                    <SmallDateInput value={vehicleReportStart} onChange={setVehicleReportStart} placeholder="Başlangıç" />
                    <SmallDateInput value={vehicleReportEnd} onChange={setVehicleReportEnd} placeholder="Bitiş" />
                    <button
                      onClick={buildVehicleReport}
                      className="h-12 rounded-xl bg-red-600 px-4 font-medium text-white transition hover:bg-red-500 md:h-11"
                    >
                      Rapor al
                    </button>
                  </div>
                }
              >
                <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_170px]">
                  <TextInput value={vehicleSearchPlate} onChange={setVehicleSearchPlate} placeholder="Plaka yaz" />
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                    <span className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Ara
                    </span>
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard title="Mekanik Kayıt" value={String(vehicleMechanicRows.length)} icon={<Wrench className="h-5 w-5" />} />
                  <StatCard title="Ekspertiz Kayıt" value={String(vehicleExpertiseRows.length)} icon={<ClipboardCheck className="h-5 w-5" />} />
                  <StatCard title="Parça Kayıt" value={String(vehiclePartsRows.length)} icon={<Package className="h-5 w-5" />} />
                  <StatCard title="İş Emri Kayıt" value={String(vehicleWorkOrderRows.length)} icon={<FileText className="h-5 w-5" />} />
                </div>

                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="mb-3 text-lg font-bold text-white">Mekanik Geçmişi</h3>
                    <DataTable
                      headers={["Tarih", "Araç", "Plaka", "İşlem", "Toplam"]}
                      rows={vehicleMechanicRows.map((item) => [
                        item.date,
                        item.car,
                        item.plate,
                        item.service,
                        formatTRY(item.total),
                      ])}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 text-lg font-bold text-white">Ekspertiz Geçmişi</h3>
                    <DataTable
                      headers={["Tarih", "Araç", "Plaka", "Paket", "Ücret"]}
                      rows={vehicleExpertiseRows.map((item) => [
                        item.date,
                        item.car,
                        item.plate,
                        item.packageType,
                        formatTRY(item.fee),
                      ])}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 text-lg font-bold text-white">Parça Geçmişi</h3>
                    <DataTable
                      headers={["Tarih", "Parça", "Araç", "Plaka", "Tutar"]}
                      rows={vehiclePartsRows.map((item) => [
                        item.date,
                        item.part,
                        item.car,
                        item.plate || "-",
                        formatTRY(item.cost),
                      ])}
                    />
                  </div>

                  <div>
                    <h3 className="mb-3 text-lg font-bold text-white">İş Emri Geçmişi</h3>
                    <DataTable
                      headers={["Tarih", "Müşteri", "Araç", "Plaka", "Toplam"]}
                      rows={vehicleWorkOrderRows.map((item) => [
                        item.date,
                        item.customer,
                        item.car,
                        item.plate,
                        formatTRY(item.grandTotal),
                      ])}
                    />
                  </div>
                </div>
              </SectionCard>
            )}

            {tab === "order" && (
              <div className="space-y-6">
                <SectionCard
                  icon={<FileText className="h-5 w-5" />}
                  title="İş Emri"
                  desc="İş emri oluştur, kaydet, güncelle, PDF al"
                  right={<FilterBar filter={workOrderFilter} setFilter={setWorkOrderFilter} onReport={buildWorkOrderReport} />}
                >
                  <div className="mb-4 text-xs text-zinc-400">
                    {isAdmin
                      ? "Admin: kaydetme, düzenleme, silme açık."
                      : "Personel: yeni iş emri kaydı açabilir."}
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xl md:p-6">
                    <div className="mb-6 text-center">
                      <h2 className="text-2xl font-black text-zinc-900 md:text-3xl">ORGUNLAR GARAGE</h2>
                      <p className="mt-2 text-sm font-semibold tracking-[0.2em] text-red-600 md:text-lg md:tracking-[0.25em]">
                        ARAÇ İŞ EMRİ FORMU
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 rounded-3xl border border-red-200 bg-zinc-50 p-4">
                        <div className="font-bold text-red-600">Müşteri Bilgileri</div>
                        <TextInput value={orderForm.customer} onChange={(value) => setOrderForm({ ...orderForm, customer: value })} placeholder="Müşteri adı" />
                        <TextInput value={orderForm.phone} onChange={(value) => setOrderForm({ ...orderForm, phone: value })} placeholder="Telefon" />
                        <TextInput value={orderForm.date} onChange={(value) => setOrderForm({ ...orderForm, date: value })} placeholder="Tarih gg.aa.yyyy" />
                        <TextInput value={orderForm.address} onChange={(value) => setOrderForm({ ...orderForm, address: value })} placeholder="Adres" />
                      </div>

                      <div className="space-y-3 rounded-3xl border border-red-200 bg-zinc-50 p-4">
                        <div className="font-bold text-red-600">Araç Bilgileri</div>
                        <TextInput value={orderForm.car} onChange={(value) => setOrderForm({ ...orderForm, car: value })} placeholder="Araç" />
                        <TextInput value={orderForm.plate} onChange={(value) => setOrderForm({ ...orderForm, plate: value })} placeholder="Plaka" />
                        <TextInput value={orderForm.chassis} onChange={(value) => setOrderForm({ ...orderForm, chassis: value })} placeholder="Şasi No" />
                        <TextInput value={orderForm.km} onChange={(value) => setOrderForm({ ...orderForm, km: value })} placeholder="KM" />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 rounded-3xl border border-red-200 bg-zinc-50 p-4">
                      <div className="font-bold text-red-600">Müşteri Şikayetleri</div>
                      <textarea
                        value={orderForm.complaints}
                        onChange={(e) => setOrderForm({ ...orderForm, complaints: e.target.value })}
                        placeholder="Şikayetleri yaz"
                        className="min-h-[120px] w-full rounded-2xl border border-zinc-300 bg-white p-4 text-base text-zinc-900 outline-none md:text-sm"
                      />
                    </div>

                    <div className="mt-4 space-y-3 rounded-3xl border border-red-200 bg-zinc-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="font-bold text-red-600">Yapılan İşlemler</div>
                        <button
                          onClick={addOrderJob}
                          className="rounded-2xl border border-red-200 bg-white px-4 py-4 text-zinc-900 transition hover:border-red-500 md:py-3"
                        >
                          Satır ekle
                        </button>
                      </div>

                      {orderForm.jobs.map((job) => (
                        <div key={job.id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_160px_52px]">
                          <TextInput value={job.item} onChange={(value) => updateOrderJob(job.id, "item", value)} placeholder="İşlem" />
                          <TextInput value={job.qty} onChange={(value) => updateOrderJob(job.id, "qty", value)} placeholder="Adet" />
                          <TextInput value={job.price} onChange={(value) => updateOrderJob(job.id, "price", value)} placeholder="Fiyat" />
                          <button
                            onClick={() => removeOrderJob(job.id)}
                            className="rounded-2xl bg-red-600/10 p-3 text-red-600"
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-red-200 bg-zinc-50 p-4">
                        <div className="mb-2 text-sm font-semibold text-red-600">İşçilik</div>
                        <TextInput
                          value={orderForm.laborTotal}
                          onChange={(value) => setOrderForm({ ...orderForm, laborTotal: value })}
                          placeholder="İşçilik toplamı"
                        />
                      </div>

                      <div className="rounded-3xl border border-red-200 bg-zinc-50 p-4">
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                            <span className="text-zinc-600">Parça Toplamı</span>
                            <span className="font-bold text-zinc-900">{formatTRY(orderPartsTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                            <span className="text-zinc-600">Genel Toplam</span>
                            <span className="font-bold text-red-600">{formatTRY(orderGrandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col justify-end gap-3 md:flex-row">
                      {editingWorkOrderId && isAdmin ? (
                        <button
                          onClick={resetOrderForm}
                          className="rounded-2xl border border-zinc-300 bg-white px-5 py-4 font-medium text-zinc-900 transition hover:border-red-500 md:py-3"
                        >
                          İptal
                        </button>
                      ) : null}
                      <button
                        onClick={saveWorkOrder}
                        className="rounded-2xl bg-black px-5 py-4 font-medium text-white transition hover:bg-zinc-800 md:py-3"
                      >
                        {editingWorkOrderId ? "İş emrini güncelle" : "İş emrini kaydet"}
                      </button>
                      <button
                        onClick={generateOrderPDF}
                        className="rounded-2xl bg-red-600 px-5 py-4 font-medium text-white transition hover:bg-red-500 md:py-3"
                      >
                        PDF oluştur
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={<FileText className="h-5 w-5" />}
                  title="Kayıtlı İş Emirleri"
                  desc="Eski iş emirlerini görüntüle, ara, düzenle ve sil"
                >
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <TextInput
                      value={workOrderSearch}
                      onChange={setWorkOrderSearch}
                      placeholder="Müşteri / araç / plaka / telefon ara"
                    />
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      Kayıt: <span className="font-semibold text-white">{workOrderRows.length}</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      Toplam:{" "}
                      <span className="font-semibold text-white">
                        {formatTRY(workOrderRows.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0))}
                      </span>
                    </div>
                  </div>

                  <DataTable
                    headers={["Tarih", "Müşteri", "Araç", "Plaka", "Toplam", "İşlem"]}
                    rows={workOrderRows.map((item) => [
                      item.date,
                      item.customer,
                      item.car,
                      item.plate,
                      formatTRY(item.grandTotal),
                      <div key={item.id} className="flex gap-2">
                        <button
                          onClick={() => editWorkOrder(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteWorkOrder(item.id)}
                          className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>,
                    ])}
                  />
                </SectionCard>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}