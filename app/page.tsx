"use client";

import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import {
  BadgeDollarSign,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
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
type UserName = "ismail" | "vahit" | "toprak";

type MechanicRecord = {
  id: number;
  date: string;
  car: string;
  plate: string;
  service: string;
  partCost: number;
  labor: number;
  total: number;
  createdBy: string;
  partSupplierId: number | null;
  partPaymentStatus: "Ödendi" | "Ödenmedi";
};

type ExpertiseRecord = {
  id: number;
  date: string;
  car: string;
  plate: string;
  packageType: string;
  fee: number;
  payment: string;
  createdBy: string;
};

type ExpenseRecord = {
  id: number;
  date: string;
  type: string;
  note: string;
  amount: number;
  createdBy: string;
};

type Supplier = {
  id: number;
  name: string;
  phone: string;
  note: string;
  createdBy: string;
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
  createdBy: string;
};

type EmployeePaymentRecord = {
  id: number;
  date: string;
  employeeName: string;
  note: string;
  amount: number;
  createdBy: string;
};

type OrderJob = {
  id: number;
  item: string;
  qty: string;
  price: string;
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
  createdBy: string;
  paymentStatus: "Ödendi" | "Ödenmedi";
  pushedToMechanic: boolean;
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

const SESSION_KEY = "orgunlar-panel-session-v2";
const SETTINGS_KEY = "orgunlar-panel-settings-v2";
const PANEL_VERSION = "v2026.04.17";

const USERS: Record<UserName, { username: UserName; password: string; role: Role }> = {
  ismail: { username: "ismail", password: "Sma8418r", role: "admin" },
  vahit: { username: "vahit", password: "Orgunlar", role: "staff" },
  toprak: { username: "toprak", password: "Orgunlar", role: "staff" },
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

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDateForInput(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = parseDate(value);
  return parsed ? toISODate(parsed) : "";
}

function formatDateForDisplay(value: string) {
  if (!value) return "-";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return value;
  const parsed = parseDate(value);
  return parsed ? toDDMMYYYY(parsed) : value;
}

function inRange(dateValue: string, start: string, end: string) {
  if (!start && !end) return true;
  const date = parseDate(dateValue);
  if (!date) return false;

  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  const startOk =
    !startDate ||
    target >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

  const endOk =
    !endDate ||
    target <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

  return startOk && endOk;
}

function isSameDay(dateValue: string, target: Date) {
  const parsed = parseDate(dateValue);
  if (!parsed) return false;
  return (
    parsed.getFullYear() === target.getFullYear() &&
    parsed.getMonth() === target.getMonth() &&
    parsed.getDate() === target.getDate()
  );
}

function isSameMonth(dateValue: string, date: Date) {
  const parsed = parseDate(dateValue);
  if (!parsed) return false;
  return parsed.getFullYear() === date.getFullYear() && parsed.getMonth() === date.getMonth();
}

function getWeekRange(baseDate: Date, weekOffset: number) {
  const current = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + mondayOffset + weekOffset * 7);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { monday, saturday };
}

function isWithinWeek(dateValue: string, monday: Date, saturday: Date) {
  const parsed = parseDate(dateValue);
  if (!parsed) return false;
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();
  const end = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate()).getTime();
  return target >= start && target <= end;
}

function pdfText(text: string | number | null | undefined) {
  return String(text ?? "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
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
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      value={normalizeDateForInput(value)}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-red-500 md:h-11 md:w-[170px]"
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
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-400">{title}</div>
          <div className="mt-2 text-2xl font-black text-white">{value}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
          {icon}
        </div>
      </div>
    </div>
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
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-zinc-500">
            Kayıt yok
          </div>
        ) : (
          rows.map((row, i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <div className="space-y-3">
                {row.map((cell, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-[95px] text-[11px] font-bold uppercase tracking-wide text-zinc-400">
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

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-black/30 md:block">
        <div className="min-w-[1100px]">
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

function WeeklyChart({
  data,
}: {
  data: { label: string; income: number; expense: number }[];
}) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));

  return (
    <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-bold text-white">Haftalık Grafik</div>
          <div className="text-sm text-zinc-400">Pazartesi - Cumartesi</div>
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

      <div className="grid h-72 grid-cols-6 items-end gap-3">
        {data.map((item) => {
          const incomeHeight = Math.max(8, (item.income / maxValue) * 200);
          const expenseHeight = Math.max(8, (item.expense / maxValue) * 200);

          return (
            <div key={item.label} className="flex flex-col items-center justify-end gap-2">
              <div className="flex h-[220px] items-end gap-2">
                <div
                  className="w-5 rounded-t-2xl bg-gradient-to-t from-emerald-600 to-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                  style={{ height: item.income > 0 ? incomeHeight : 6 }}
                />
                <div
                  className="w-5 rounded-t-2xl bg-gradient-to-t from-red-700 to-red-300 shadow-[0_0_18px_rgba(239,68,68,0.30)]"
                  style={{ height: item.expense > 0 ? expenseHeight : 6 }}
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

function SupplierDebtChart({
  rows,
  maxAmount,
}: {
  rows: { name: string; amount: number }[];
  maxAmount: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
      <div className="mb-4">
        <div className="text-lg font-bold text-white">Parçacı Borçları</div>
        <div className="text-sm text-zinc-400">Sadece ödenmemişler</div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-500">Ödenmemiş parçacı borcu yok</div>
        ) : (
          rows.map((row) => (
            <div key={row.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-200">{row.name}</span>
                <span className="font-semibold text-white">{formatTRY(row.amount)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-red-300"
                  style={{ width: `${Math.max(6, (row.amount / Math.max(maxAmount, 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<AppData>(initialData);
  const [loadingData, setLoadingData] = useState(true);

  const [tab, setTab] = useState("panel");
  const [session, setSession] = useState<{ username: UserName; role: Role } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  const [mechanicForm, setMechanicForm] = useState({
    date: toISODate(new Date()),
    car: "",
    plate: "",
    service: "",
    partCost: "",
    labor: "",
    total: "",
    partSupplierId: "",
    partPaymentStatus: "Ödenmedi",
  });
  const [editingMechanicId, setEditingMechanicId] = useState<number | null>(null);

  const [expertiseForm, setExpertiseForm] = useState({
    date: toISODate(new Date()),
    car: "",
    plate: "",
    packageType: "",
    fee: "",
    payment: "Nakit",
  });
  const [editingExpertiseId, setEditingExpertiseId] = useState<number | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    date: toISODate(new Date()),
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
    date: toISODate(new Date()),
    part: "",
    car: "",
    plate: "",
    cost: "",
    supplierId: "",
    paid: "Ödenmedi",
  });
  const [editingPartId, setEditingPartId] = useState<number | null>(null);

  const [employeeForm, setEmployeeForm] = useState({
    date: toISODate(new Date()),
    employeeName: "",
    note: "",
    amount: "",
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);

  const [vehicleSearchPlate, setVehicleSearchPlate] = useState("");
  const [vehicleReportStart, setVehicleReportStart] = useState("");
  const [vehicleReportEnd, setVehicleReportEnd] = useState("");

  const [orderForm, setOrderForm] = useState({
    customer: "",
    phone: "",
    date: toISODate(new Date()),
    address: "",
    car: "",
    plate: "",
    chassis: "",
    km: "",
    complaints: "",
    laborTotal: "",
    paymentStatus: "Ödenmedi",
    jobs: [{ id: uid(), item: "", qty: "", price: "" }],
  });
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<number | null>(null);

  const [mechanicFilter, setMechanicFilter] = useState({ start: "", end: "" });
  const [expertiseFilter, setExpertiseFilter] = useState({ start: "", end: "" });
  const [expenseFilter, setExpenseFilter] = useState({ start: "", end: "" });
  const [partsFilter, setPartsFilter] = useState({ start: "", end: "" });
  const [employeeFilter, setEmployeeFilter] = useState({ start: "", end: "" });
  const [workOrderFilter, setWorkOrderFilter] = useState({ start: "", end: "" });

  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("");
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [rentForm, setRentForm] = useState("");

  const [weekOffset, setWeekOffset] = useState(0);
  const [excelStart, setExcelStart] = useState("");
  const [excelEnd, setExcelEnd] = useState("");

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
        createdBy: item.created_by || "-",
        partSupplierId:
          item.part_supplier_id === null || item.part_supplier_id === undefined
            ? null
            : Number(item.part_supplier_id),
        partPaymentStatus: item.part_payment_status === "Ödendi" ? "Ödendi" : "Ödenmedi",
      })),
      expertise: (expertiseRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        car: item.car || "",
        plate: item.plate || "",
        packageType: item.package_type || "",
        fee: Number(item.fee || 0),
        payment: item.payment || "Nakit",
        createdBy: item.created_by || "-",
      })),
      expenses: (expensesRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        type: item.type || "",
        note: item.note || "",
        amount: Number(item.amount || 0),
        createdBy: item.created_by || "-",
      })),
      suppliers: (suppliersRes.data || []).map((item) => ({
        id: Number(item.id),
        name: item.name || "",
        phone: item.phone || "",
        note: item.note || "",
        createdBy: item.created_by || "-",
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
        createdBy: item.created_by || "-",
      })),
      employeePayments: (employeeRes.data || []).map((item) => ({
        id: Number(item.id),
        date: item.date || "",
        employeeName: item.employee_name || "",
        note: item.note || "",
        amount: Number(item.amount || 0),
        createdBy: item.created_by || "-",
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
        createdBy: item.created_by || "-",
        paymentStatus: item.payment_status === "Ödendi" ? "Ödendi" : "Ödenmedi",
        pushedToMechanic: Boolean(item.pushed_to_mechanic),
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
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ baseRent: Number(data.settings?.baseRent || 25000) })
    );
    setRentForm(String(data.settings?.baseRent || 0));
  }, [data.settings?.baseRent]);

  const isAdmin = session?.role === "admin";
  const canAdd = Boolean(session);

  const supplierNameById = (id: number | null) =>
    data.suppliers.find((supplier) => supplier.id === id)?.name || "-";

  const mechanicRows = useMemo(
    () => data.mechanic.filter((record) => inRange(record.date, mechanicFilter.start, mechanicFilter.end)),
    [data.mechanic, mechanicFilter]
  );

  const expertiseRows = useMemo(
    () => data.expertise.filter((record) => inRange(record.date, expertiseFilter.start, expertiseFilter.end)),
    [data.expertise, expertiseFilter]
  );

  const expenseRows = useMemo(
    () => data.expenses.filter((record) => inRange(record.date, expenseFilter.start, expenseFilter.end)),
    [data.expenses, expenseFilter]
  );

  const partsRows = useMemo(
    () =>
      data.parts.filter((record) => {
        const dateOk = inRange(record.date, partsFilter.start, partsFilter.end);
        const supplierOk = selectedSupplierFilter
          ? String(record.supplierId) === selectedSupplierFilter
          : true;
        return dateOk && supplierOk;
      }),
    [data.parts, partsFilter, selectedSupplierFilter]
  );

  const employeeRows = useMemo(
    () => data.employeePayments.filter((record) => inRange(record.date, employeeFilter.start, employeeFilter.end)),
    [data.employeePayments, employeeFilter]
  );

  const workOrderRows = useMemo(() => {
    const normalized = workOrderSearch.trim().toLowerCase();

    return data.workOrders.filter((record) => {
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

  const todayDate = new Date();
  const currentWeekRange = getWeekRange(todayDate, weekOffset);

  const dailyIncome =
    data.mechanic.filter((x) => isSameDay(x.date, todayDate)).reduce((sum, x) => sum + x.total, 0) +
    data.expertise.filter((x) => isSameDay(x.date, todayDate)).reduce((sum, x) => sum + x.fee, 0);

  const dailyExpense =
    data.expenses.filter((x) => isSameDay(x.date, todayDate)).reduce((sum, x) => sum + x.amount, 0) +
    data.employeePayments.filter((x) => isSameDay(x.date, todayDate)).reduce((sum, x) => sum + x.amount, 0);

  const weeklyIncome =
    data.mechanic
      .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
      .reduce((sum, x) => sum + x.total, 0) +
    data.expertise
      .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
      .reduce((sum, x) => sum + x.fee, 0);

  const weeklyExpense =
    data.expenses
      .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
      .reduce((sum, x) => sum + x.amount, 0) +
    data.employeePayments
      .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
      .reduce((sum, x) => sum + x.amount, 0);

  const monthlyIncome =
    data.mechanic.filter((x) => isSameMonth(x.date, todayDate)).reduce((sum, x) => sum + x.total, 0) +
    data.expertise.filter((x) => isSameMonth(x.date, todayDate)).reduce((sum, x) => sum + x.fee, 0);

  const monthlyExpense =
    data.expenses.filter((x) => isSameMonth(x.date, todayDate)).reduce((sum, x) => sum + x.amount, 0) +
    data.employeePayments.filter((x) => isSameMonth(x.date, todayDate)).reduce((sum, x) => sum + x.amount, 0);

  const unpaidPartTableDebt = data.parts.filter((item) => !item.paid).reduce((sum, item) => sum + item.cost, 0);

  const unpaidMechanicPartDebt = data.mechanic
    .filter((item) => item.partSupplierId && item.partPaymentStatus === "Ödenmedi")
    .reduce((sum, item) => sum + item.partCost, 0);

  const totalDebt = unpaidPartTableDebt + unpaidMechanicPartDebt;

  const totalIncomeAll = data.mechanic.reduce((s, x) => s + x.total, 0) + data.expertise.reduce((s, x) => s + x.fee, 0);
  const totalExpenseAll = data.expenses.reduce((s, x) => s + x.amount, 0) + data.employeePayments.reduce((s, x) => s + x.amount, 0);
  const netAll = totalIncomeAll - totalExpenseAll - totalDebt;
  const afterRent = netAll - Number(data.settings.baseRent || 0);

  const weekDays = useMemo(() => {
    const labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    return labels.map((label, index) => {
      const d = new Date(currentWeekRange.monday);
      d.setDate(currentWeekRange.monday.getDate() + index);
      return {
        label,
        date: toDDMMYYYY(d),
      };
    });
  }, [currentWeekRange.monday]);

  const weeklyChartData = useMemo(() => {
    return weekDays.map((item) => {
      const income =
        data.mechanic
          .filter((x) => formatDateForDisplay(x.date) === item.date)
          .reduce((sum, x) => sum + x.total, 0) +
        data.expertise
          .filter((x) => formatDateForDisplay(x.date) === item.date)
          .reduce((sum, x) => sum + x.fee, 0);

      const expense =
        data.expenses
          .filter((x) => formatDateForDisplay(x.date) === item.date)
          .reduce((sum, x) => sum + x.amount, 0) +
        data.employeePayments
          .filter((x) => formatDateForDisplay(x.date) === item.date)
          .reduce((sum, x) => sum + x.amount, 0);

      return { label: item.label, income, expense };
    });
  }, [data.mechanic, data.expertise, data.expenses, data.employeePayments, weekDays]);

  const supplierDebtRows = useMemo(() => {
    const map = new Map<string, number>();

    data.parts
      .filter((item) => !item.paid)
      .forEach((item) => {
        const name = supplierNameById(item.supplierId);
        map.set(name, (map.get(name) || 0) + item.cost);
      });

    data.mechanic
      .filter((item) => item.partSupplierId && item.partPaymentStatus === "Ödenmedi")
      .forEach((item) => {
        const name = supplierNameById(item.partSupplierId);
        map.set(name, (map.get(name) || 0) + item.partCost);
      });

    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.parts, data.mechanic, data.suppliers]);

  const maxSupplierDebt = Math.max(1, ...supplierDebtRows.map((item) => item.amount));

  const weeklyIncomeDetailed = useMemo(() => {
    return [
      ...data.mechanic
        .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
        .map((x) => ({
          date: formatDateForDisplay(x.date),
          type: "Mekanik",
          title: `${x.car} / ${x.plate || "-"}`,
          detail: x.service || "-",
          amount: x.total,
          createdBy: (x.createdBy || "-").toLowerCase(),
        })),
      ...data.expertise
        .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
        .map((x) => ({
          date: formatDateForDisplay(x.date),
          type: "Ekspertiz",
          title: `${x.car} / ${x.plate || "-"}`,
          detail: x.packageType || "-",
          amount: x.fee,
          createdBy: (x.createdBy || "-").toLowerCase(),
        })),
    ].sort((a, b) => {
      const ad = parseDate(a.date)?.getTime() || 0;
      const bd = parseDate(b.date)?.getTime() || 0;
      return bd - ad;
    });
  }, [data.mechanic, data.expertise, currentWeekRange.monday, currentWeekRange.saturday]);

  const weeklyExpenseDetailed = useMemo(() => {
    return [
      ...data.expenses
        .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
        .map((x) => ({
          date: formatDateForDisplay(x.date),
          type: "Gider",
          title: x.type,
          detail: x.note || "-",
          amount: x.amount,
          createdBy: (x.createdBy || "-").toLowerCase(),
        })),
      ...data.employeePayments
        .filter((x) => isWithinWeek(x.date, currentWeekRange.monday, currentWeekRange.saturday))
        .map((x) => ({
          date: formatDateForDisplay(x.date),
          type: "Eleman",
          title: x.employeeName,
          detail: x.note || "-",
          amount: x.amount,
          createdBy: (x.createdBy || "-").toLowerCase(),
        })),
    ].sort((a, b) => {
      const ad = parseDate(a.date)?.getTime() || 0;
      const bd = parseDate(b.date)?.getTime() || 0;
      return bd - ad;
    });
  }, [data.expenses, data.employeePayments, currentWeekRange.monday, currentWeekRange.saturday]);

  const weeklyPersonStats = useMemo(() => {
    const people: UserName[] = ["ismail", "vahit", "toprak"];

    return people.map((person) => {
      const income = weeklyIncomeDetailed
        .filter((x) => x.createdBy === person)
        .reduce((sum, x) => sum + x.amount, 0);

      const expense = weeklyExpenseDetailed
        .filter((x) => x.createdBy === person)
        .reduce((sum, x) => sum + x.amount, 0);

      return {
        key: person,
        label: person.charAt(0).toUpperCase() + person.slice(1),
        income,
        expense,
        net: income - expense,
      };
    });
  }, [weeklyIncomeDetailed, weeklyExpenseDetailed]);

  const ismailWeekNet = weeklyPersonStats.find((x) => x.key === "ismail")?.net || 0;
  const vahitWeekNet = weeklyPersonStats.find((x) => x.key === "vahit")?.net || 0;
  const topraWeekNet = weeklyPersonStats.find((x) => x.key === "toprak")?.net || 0;

  const weeklyNet = weeklyIncome - weeklyExpense;
  const equalShare = weeklyNet / 2;
  const ismailDifference = equalShare - ismailWeekNet;
  const vahitDifference = equalShare - vahitWeekNet;

  const normalizedVehiclePlate = vehicleSearchPlate.trim().toLowerCase();

  const vehicleMechanicRows = useMemo(
    () =>
      data.mechanic.filter((item) => {
        const plateOk = normalizedVehiclePlate
          ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
          : true;
        const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
        return plateOk && dateOk;
      }),
    [data.mechanic, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]
  );

  const vehicleExpertiseRows = useMemo(
    () =>
      data.expertise.filter((item) => {
        const plateOk = normalizedVehiclePlate
          ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
          : true;
        const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
        return plateOk && dateOk;
      }),
    [data.expertise, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]
  );

  const vehiclePartsRows = useMemo(
    () =>
      data.parts.filter((item) => {
        const plateOk = normalizedVehiclePlate
          ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
          : true;
        const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
        return plateOk && dateOk;
      }),
    [data.parts, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]
  );

  const vehicleWorkOrderRows = useMemo(
    () =>
      data.workOrders.filter((item) => {
        const plateOk = normalizedVehiclePlate
          ? (item.plate || "").toLowerCase().includes(normalizedVehiclePlate)
          : true;
        const dateOk = inRange(item.date, vehicleReportStart, vehicleReportEnd);
        return plateOk && dateOk;
      }),
    [data.workOrders, normalizedVehiclePlate, vehicleReportStart, vehicleReportEnd]
  );

  function resetMechanicForm() {
    setMechanicForm({
      date: toISODate(new Date()),
      car: "",
      plate: "",
      service: "",
      partCost: "",
      labor: "",
      total: "",
      partSupplierId: "",
      partPaymentStatus: "Ödenmedi",
    });
    setEditingMechanicId(null);
  }

  function resetExpertiseForm() {
    setExpertiseForm({
      date: toISODate(new Date()),
      car: "",
      plate: "",
      packageType: "",
      fee: "",
      payment: "Nakit",
    });
    setEditingExpertiseId(null);
  }

  function resetExpenseForm() {
    setExpenseForm({
      date: toISODate(new Date()),
      type: "",
      note: "",
      amount: "",
    });
    setEditingExpenseId(null);
  }

  function resetSupplierForm() {
    setSupplierForm({
      name: "",
      phone: "",
      note: "",
    });
    setEditingSupplierId(null);
  }

  function resetPartForm() {
    setPartForm({
      date: toISODate(new Date()),
      part: "",
      car: "",
      plate: "",
      cost: "",
      supplierId: "",
      paid: "Ödenmedi",
    });
    setEditingPartId(null);
  }

  function resetEmployeeForm() {
    setEmployeeForm({
      date: toISODate(new Date()),
      employeeName: "",
      note: "",
      amount: "",
    });
    setEditingEmployeeId(null);
  }

  function resetOrderForm() {
    setOrderForm({
      customer: "",
      phone: "",
      date: toISODate(new Date()),
      address: "",
      car: "",
      plate: "",
      chassis: "",
      km: "",
      complaints: "",
      laborTotal: "",
      paymentStatus: "Ödenmedi",
      jobs: [{ id: uid(), item: "", qty: "", price: "" }],
    });
    setEditingWorkOrderId(null);
  }

  function handleLogin() {
    const username = loginForm.username.trim().toLowerCase() as UserName;
    const user = USERS[username];

    if (!user || user.password !== loginForm.password) {
      alert("Kullanıcı adı veya şifre yanlış");
      return;
    }

    setSession({ username: user.username, role: user.role });
    setLoginForm({ username: "", password: "" });
  }

  function logout() {
    setSession(null);
  }

  function updateRent() {
    if (!isAdmin) return;
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, baseRent: Number(rentForm || 0) },
    }));
  }

  async function addMechanic() {
    if (!canAdd || !session) return;
    if (!mechanicForm.date || !mechanicForm.car || !mechanicForm.total) {
      alert("Tarih, araç ve toplam boş olamaz");
      return;
    }

    const insertPayload = {
      date: mechanicForm.date,
      car: mechanicForm.car,
      plate: mechanicForm.plate,
      service: mechanicForm.service,
      part_cost: Number(mechanicForm.partCost || 0),
      labor: Number(mechanicForm.labor || 0),
      total: Number(mechanicForm.total || 0),
      created_by: session.username,
      part_supplier_id: mechanicForm.partSupplierId ? Number(mechanicForm.partSupplierId) : null,
      part_payment_status: mechanicForm.partPaymentStatus,
    };

    const updatePayload = {
      date: mechanicForm.date,
      car: mechanicForm.car,
      plate: mechanicForm.plate,
      service: mechanicForm.service,
      part_cost: Number(mechanicForm.partCost || 0),
      labor: Number(mechanicForm.labor || 0),
      total: Number(mechanicForm.total || 0),
      part_supplier_id: mechanicForm.partSupplierId ? Number(mechanicForm.partSupplierId) : null,
      part_payment_status: mechanicForm.partPaymentStatus,
    };

    if (editingMechanicId) {
      const { error } = await supabase
        .from("mechanic_records")
        .update(updatePayload)
        .eq("id", editingMechanicId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("mechanic_records").insert([insertPayload]);
      if (error) return alert(error.message);
    }

    resetMechanicForm();
    loadAllData();
  }

  function editMechanic(id: number) {
    if (!isAdmin) return;
    const item = data.mechanic.find((x) => x.id === id);
    if (!item) return;
    setEditingMechanicId(id);
    setMechanicForm({
      date: normalizeDateForInput(item.date),
      car: item.car,
      plate: item.plate,
      service: item.service,
      partCost: String(item.partCost),
      labor: String(item.labor),
      total: String(item.total),
      partSupplierId: item.partSupplierId ? String(item.partSupplierId) : "",
      partPaymentStatus: item.partPaymentStatus,
    });
  }

  async function deleteMechanic(id: number) {
    if (!isAdmin) return;
    const { error } = await supabase.from("mechanic_records").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingMechanicId === id) resetMechanicForm();
    loadAllData();
  }

  async function addExpertise() {
    if (!canAdd || !session) return;
    if (!expertiseForm.date || !expertiseForm.car || !expertiseForm.fee) {
      alert("Tarih, araç ve ücret boş olamaz");
      return;
    }

    const insertPayload = {
      date: expertiseForm.date,
      car: expertiseForm.car,
      plate: expertiseForm.plate,
      package_type: expertiseForm.packageType,
      fee: Number(expertiseForm.fee || 0),
      payment: expertiseForm.payment,
      created_by: session.username,
    };

    const updatePayload = {
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
        .update(updatePayload)
        .eq("id", editingExpertiseId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("expertise_records").insert([insertPayload]);
      if (error) return alert(error.message);
    }

    resetExpertiseForm();
    loadAllData();
  }

  function editExpertise(id: number) {
    if (!isAdmin) return;
    const item = data.expertise.find((x) => x.id === id);
    if (!item) return;
    setEditingExpertiseId(id);
    setExpertiseForm({
      date: normalizeDateForInput(item.date),
      car: item.car,
      plate: item.plate,
      packageType: item.packageType,
      fee: String(item.fee),
      payment: item.payment,
    });
  }

  async function deleteExpertise(id: number) {
    if (!isAdmin) return;
    const { error } = await supabase.from("expertise_records").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingExpertiseId === id) resetExpertiseForm();
    loadAllData();
  }

  async function addExpense() {
    if (!canAdd || !session) return;
    if (!expenseForm.date || !expenseForm.type || !expenseForm.amount) {
      alert("Tarih, tür ve tutar boş olamaz");
      return;
    }

    const insertPayload = {
      date: expenseForm.date,
      type: expenseForm.type,
      note: expenseForm.note,
      amount: Number(expenseForm.amount || 0),
      created_by: session.username,
    };

    const updatePayload = {
      date: expenseForm.date,
      type: expenseForm.type,
      note: expenseForm.note,
      amount: Number(expenseForm.amount || 0),
    };

    if (editingExpenseId) {
      const { error } = await supabase.from("expenses").update(updatePayload).eq("id", editingExpenseId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("expenses").insert([insertPayload]);
      if (error) return alert(error.message);
    }

    resetExpenseForm();
    loadAllData();
  }

  function editExpense(id: number) {
    if (!isAdmin) return;
    const item = data.expenses.find((x) => x.id === id);
    if (!item) return;
    setEditingExpenseId(id);
    setExpenseForm({
      date: normalizeDateForInput(item.date),
      type: item.type,
      note: item.note,
      amount: String(item.amount),
    });
  }

  async function deleteExpense(id: number) {
    if (!isAdmin) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingExpenseId === id) resetExpenseForm();
    loadAllData();
  }

  async function addSupplier() {
    if (!canAdd || !session) return;
    if (!supplierForm.name) {
      alert("Parçacı adı boş olamaz");
      return;
    }

    const insertPayload = {
      name: supplierForm.name,
      phone: supplierForm.phone,
      note: supplierForm.note,
      created_by: session.username,
    };

    const updatePayload = {
      name: supplierForm.name,
      phone: supplierForm.phone,
      note: supplierForm.note,
    };

    if (editingSupplierId) {
      const { error } = await supabase.from("suppliers").update(updatePayload).eq("id", editingSupplierId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("suppliers").insert([insertPayload]);
      if (error) return alert(error.message);
    }

    resetSupplierForm();
    loadAllData();
  }

  function editSupplier(id: number) {
    if (!isAdmin) return;
    const item = data.suppliers.find((x) => x.id === id);
    if (!item) return;
    setEditingSupplierId(id);
    setSupplierForm({
      name: item.name,
      phone: item.phone,
      note: item.note,
    });
  }

  async function deleteSupplier(id: number) {
    if (!isAdmin) return;
    const used =
      data.parts.some((x) => x.supplierId === id) || data.mechanic.some((x) => x.partSupplierId === id);
    if (used) return alert("Bu parçacı kayıtlarda kullanılıyor");
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingSupplierId === id) resetSupplierForm();
    loadAllData();
  }

  async function addPart() {
    if (!canAdd || !session) return;
    if (!partForm.date || !partForm.part || !partForm.cost || !partForm.supplierId) {
      alert("Tarih, parça, tutar ve parçacı boş olamaz");
      return;
    }

    const insertPayload = {
      date: partForm.date,
      part: partForm.part,
      car: partForm.car,
      plate: partForm.plate,
      cost: Number(partForm.cost || 0),
      supplier_id: Number(partForm.supplierId),
      paid: partForm.paid === "Ödendi",
      created_by: session.username,
    };

    const updatePayload = {
      date: partForm.date,
      part: partForm.part,
      car: partForm.car,
      plate: partForm.plate,
      cost: Number(partForm.cost || 0),
      supplier_id: Number(partForm.supplierId),
      paid: partForm.paid === "Ödendi",
    };

    if (editingPartId) {
      const { error } = await supabase.from("parts").update(updatePayload).eq("id", editingPartId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("parts").insert([insertPayload]);
      if (error) return alert(error.message);
    }

    resetPartForm();
    loadAllData();
  }

  function editPart(id: number) {
    if (!isAdmin) return;
    const item = data.parts.find((x) => x.id === id);
    if (!item) return;
    setEditingPartId(id);
    setPartForm({
      date: normalizeDateForInput(item.date),
      part: item.part,
      car: item.car,
      plate: item.plate,
      cost: String(item.cost),
      supplierId: String(item.supplierId),
      paid: item.paid ? "Ödendi" : "Ödenmedi",
    });
  }

  async function deletePart(id: number) {
    if (!isAdmin) return;
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingPartId === id) resetPartForm();
    loadAllData();
  }

  async function addEmployeePayment() {
    if (!canAdd || !session) return;
    if (!employeeForm.date || !employeeForm.employeeName || !employeeForm.amount) {
      alert("Tarih, eleman adı ve tutar boş olamaz");
      return;
    }

    const insertPayload = {
      date: employeeForm.date,
      employee_name: employeeForm.employeeName,
      note: employeeForm.note,
      amount: Number(employeeForm.amount || 0),
      created_by: session.username,
    };

    const updatePayload = {
      date: employeeForm.date,
      employee_name: employeeForm.employeeName,
      note: employeeForm.note,
      amount: Number(employeeForm.amount || 0),
    };

    if (editingEmployeeId) {
      const { error } = await supabase
        .from("employee_payments")
        .update(updatePayload)
        .eq("id", editingEmployeeId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("employee_payments").insert([insertPayload]);
      if (error) return alert(error.message);
    }

    resetEmployeeForm();
    loadAllData();
  }

  function editEmployeePayment(id: number) {
    if (!isAdmin) return;
    const item = data.employeePayments.find((x) => x.id === id);
    if (!item) return;
    setEditingEmployeeId(id);
    setEmployeeForm({
      date: normalizeDateForInput(item.date),
      employeeName: item.employeeName,
      note: item.note,
      amount: String(item.amount),
    });
  }

  async function deleteEmployeePayment(id: number) {
    if (!isAdmin) return;
    const { error } = await supabase.from("employee_payments").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingEmployeeId === id) resetEmployeeForm();
    loadAllData();
  }

  async function saveWorkOrder() {
    if (!canAdd || !session) return;
    if (!orderForm.customer || !orderForm.date || !orderForm.car || !orderForm.plate) {
      alert("Müşteri, tarih, araç ve plaka boş olamaz");
      return;
    }

    const cleanedJobs = orderForm.jobs.filter(
      (job) => job.item.trim() || job.qty.trim() || job.price.trim()
    );

    const grandTotal =
      cleanedJobs.reduce((sum, item) => sum + Number(item.price || 0), 0) +
      Number(orderForm.laborTotal || 0);

    const insertPayload = {
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
      grand_total: grandTotal,
      payment_status: orderForm.paymentStatus,
      pushed_to_mechanic: orderForm.paymentStatus === "Ödendi",
      created_by: session.username,
    };

    const updatePayload = {
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
      grand_total: grandTotal,
      payment_status: orderForm.paymentStatus,
    };

    if (editingWorkOrderId) {
      const existing = data.workOrders.find((x) => x.id === editingWorkOrderId);
      if (!existing) return alert("Kayıt bulunamadı");

      const shouldPushToMechanic =
        existing.paymentStatus !== "Ödendi" &&
        orderForm.paymentStatus === "Ödendi" &&
        !existing.pushedToMechanic;

      const { error: updateError } = await supabase
        .from("work_orders")
        .update({
          ...updatePayload,
          pushed_to_mechanic: existing.pushedToMechanic || shouldPushToMechanic,
        })
        .eq("id", editingWorkOrderId);

      if (updateError) return alert(updateError.message);

      if (shouldPushToMechanic) {
        const { error: mechanicError } = await supabase.from("mechanic_records").insert([
          {
            date: orderForm.date,
            car: orderForm.car,
            plate: orderForm.plate,
            service: `İş Emri / ${orderForm.customer}`,
            part_cost: 0,
            labor: grandTotal,
            total: grandTotal,
            created_by: existing.createdBy || session.username,
            part_supplier_id: null,
            part_payment_status: "Ödendi",
          },
        ]);

        if (mechanicError) return alert(mechanicError.message);
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("work_orders")
        .insert([insertPayload])
        .select()
        .single();

      if (insertError) return alert(insertError.message);

      if (orderForm.paymentStatus === "Ödendi") {
        const { error: mechanicError } = await supabase.from("mechanic_records").insert([
          {
            date: orderForm.date,
            car: orderForm.car,
            plate: orderForm.plate,
            service: `İş Emri / ${orderForm.customer}`,
            part_cost: 0,
            labor: grandTotal,
            total: grandTotal,
            created_by: inserted?.created_by || session.username,
            part_supplier_id: null,
            part_payment_status: "Ödendi",
          },
        ]);

        if (mechanicError) return alert(mechanicError.message);
      }
    }

    resetOrderForm();
    loadAllData();
    alert("İş emri kaydedildi");
  }

  function editWorkOrder(id: number) {
    if (!isAdmin) return;
    const item = data.workOrders.find((x) => x.id === id);
    if (!item) return;

    setEditingWorkOrderId(id);
    setOrderForm({
      customer: item.customer,
      phone: item.phone,
      date: normalizeDateForInput(item.date),
      address: item.address,
      car: item.car,
      plate: item.plate,
      chassis: item.chassis,
      km: item.km,
      complaints: item.complaints,
      laborTotal: String(item.laborTotal || 0),
      paymentStatus: item.paymentStatus || "Ödenmedi",
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
  }

  async function deleteWorkOrder(id: number) {
    if (!isAdmin) return;
    const { error } = await supabase.from("work_orders").delete().eq("id", id);
    if (error) return alert(error.message);
    if (editingWorkOrderId === id) resetOrderForm();
    loadAllData();
  }

  function addOrderJob() {
    setOrderForm((prev) => ({
      ...prev,
      jobs: [...prev.jobs, { id: uid(), item: "", qty: "", price: "" }],
    }));
  }

  function updateOrderJob(id: number, field: keyof OrderJob, value: string) {
    setOrderForm((prev) => ({
      ...prev,
      jobs: prev.jobs.map((job) => (job.id === id ? { ...job, [field]: value } : job)),
    }));
  }

  function removeOrderJob(id: number) {
    setOrderForm((prev) => ({
      ...prev,
      jobs:
        prev.jobs.length > 1
          ? prev.jobs.filter((job) => job.id !== id)
          : [{ id: uid(), item: "", qty: "", price: "" }],
    }));
  }

  function createPdfDoc(title: string, subtitle?: string) {
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 210, 297, "F");

    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, 210, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ORGUNLAR GARAGE", 12, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(pdfText(subtitle || ""), 12, 22);

    doc.setTextColor(25, 25, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(pdfText(title), 12, 42);

    return doc;
  }

  function drawCard(
    doc: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    tone: "white" | "green" | "red"
  ) {
    if (tone === "white") doc.setFillColor(255, 255, 255);
    if (tone === "green") doc.setFillColor(244, 255, 247);
    if (tone === "red") doc.setFillColor(255, 244, 244);

    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(x, y, w, h, 4, 4, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(105, 105, 105);
    doc.text(pdfText(label), x + 4, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(pdfText(value), x + 4, y + 16);
  }

  function exportWeeklyPdfProfessional() {
    const doc = createPdfDoc(
      "HAFTALIK DETAYLI RAPOR",
      `${toDDMMYYYY(currentWeekRange.monday)} - ${toDDMMYYYY(currentWeekRange.saturday)}`
    );

    drawCard(doc, 12, 50, 58, 22, "Haftalik Gelir", formatTRY(weeklyIncome), "green");
    drawCard(doc, 76, 50, 58, 22, "Haftalik Gider", formatTRY(weeklyExpense), "red");
    drawCard(doc, 140, 50, 58, 22, "Haftalik Net", formatTRY(weeklyNet), "white");

    autoTable(doc, {
      startY: 80,
      head: [["Kisi", "Gelir", "Gider", "Net"]],
      body: weeklyPersonStats.map((p) => [
        pdfText(p.label),
        pdfText(formatTRY(p.income)),
        pdfText(formatTRY(p.expense)),
        pdfText(formatTRY(p.net)),
      ]),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [25, 25, 25],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 80) + 8,
      head: [["ORTAK DAGITIM OZETI", "Deger"]],
      body: [
        ["Genel Net Kazanc", pdfText(formatTRY(weeklyNet))],
        ["Kisi Basi Pay (Ismail + Vahit)", pdfText(formatTRY(equalShare))],
        [
          "Ismail Fark",
          pdfText(
            `${formatTRY(Math.abs(ismailDifference))} ${
              ismailDifference > 0 ? "alacakli" : ismailDifference < 0 ? "fazla almis" : "esit"
            }`
          ),
        ],
        [
          "Vahit Fark",
          pdfText(
            `${formatTRY(Math.abs(vahitDifference))} ${
              vahitDifference > 0 ? "alacakli" : vahitDifference < 0 ? "fazla almis" : "esit"
            }`
          ),
        ],
        ["Toprak", pdfText("Toplama dahil, paylasima dahil degil")],
      ],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [180, 20, 20],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 130) + 10,
      head: [["#", "Tarih", "Tur", "Detay", "Ekleyen", "Tutar"]],
      body: weeklyIncomeDetailed.length
        ? weeklyIncomeDetailed.map((item, index) => [
            String(index + 1),
            pdfText(item.date),
            pdfText(item.type),
            pdfText(`${item.title} - ${item.detail}`),
            pdfText(item.createdBy),
            pdfText(formatTRY(item.amount)),
          ])
        : [["-", "-", "-", "Kayit yok", "-", "-"]],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.4,
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [16, 120, 70],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 252, 248],
      },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 200) + 10,
      head: [["#", "Tarih", "Tur", "Detay", "Ekleyen", "Tutar"]],
      body: weeklyExpenseDetailed.length
        ? weeklyExpenseDetailed.map((item, index) => [
            String(index + 1),
            pdfText(item.date),
            pdfText(item.type),
            pdfText(`${item.title} - ${item.detail}`),
            pdfText(item.createdBy),
            pdfText(formatTRY(item.amount)),
          ])
        : [["-", "-", "-", "Kayit yok", "-", "-"]],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.4,
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [145, 20, 20],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [252, 248, 248],
      },
      margin: { left: 12, right: 12 },
    });

    doc.save(
      `haftalik-detayli-rapor-${toDDMMYYYY(currentWeekRange.monday)}-${toDDMMYYYY(currentWeekRange.saturday)}.pdf`
    );
  }

  function exportWeeklyExcel() {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          Baslangic: toDDMMYYYY(currentWeekRange.monday),
          Bitis: toDDMMYYYY(currentWeekRange.saturday),
          HaftalikGelir: weeklyIncome,
          HaftalikGider: weeklyExpense,
          HaftalikNet: weeklyNet,
          IsmailNet: ismailWeekNet,
          VahitNet: vahitWeekNet,
          ToprakNet: topraWeekNet,
          KisiBasiPay: equalShare,
        },
      ]),
      "Ozet"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        weeklyIncomeDetailed.map((x) => ({
          Tarih: x.date,
          Tip: x.type,
          Baslik: x.title,
          Detay: x.detail,
          Ekleyen: x.createdBy,
          Tutar: x.amount,
        }))
      ),
      "Gelirler"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        weeklyExpenseDetailed.map((x) => ({
          Tarih: x.date,
          Tip: x.type,
          Baslik: x.title,
          Detay: x.detail,
          Ekleyen: x.createdBy,
          Tutar: x.amount,
        }))
      ),
      "Giderler"
    );

    XLSX.writeFile(
      wb,
      `haftalik-rapor-${toDDMMYYYY(currentWeekRange.monday)}-${toDDMMYYYY(currentWeekRange.saturday)}.xlsx`
    );
  }

  function exportAllDataExcel() {
    const mechanic = data.mechanic.filter((x) => inRange(x.date, excelStart, excelEnd));
    const expertise = data.expertise.filter((x) => inRange(x.date, excelStart, excelEnd));
    const expenses = data.expenses.filter((x) => inRange(x.date, excelStart, excelEnd));
    const parts = data.parts.filter((x) => inRange(x.date, excelStart, excelEnd));
    const employees = data.employeePayments.filter((x) => inRange(x.date, excelStart, excelEnd));
    const orders = data.workOrders.filter((x) => inRange(x.date, excelStart, excelEnd));

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        mechanic.map((x) => ({
          Tarih: formatDateForDisplay(x.date),
          Arac: x.car,
          Plaka: x.plate,
          Islem: x.service,
          ParcaMaliyeti: x.partCost,
          Parcaci: supplierNameById(x.partSupplierId),
          ParcaOdeme: x.partPaymentStatus,
          Iscilik: x.labor,
          Toplam: x.total,
          Ekleyen: x.createdBy,
        }))
      ),
      "Mekanik"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        expertise.map((x) => ({
          Tarih: formatDateForDisplay(x.date),
          Arac: x.car,
          Plaka: x.plate,
          Paket: x.packageType,
          Ucret: x.fee,
          Odeme: x.payment,
          Ekleyen: x.createdBy,
        }))
      ),
      "Ekspertiz"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        expenses.map((x) => ({
          Tarih: formatDateForDisplay(x.date),
          Tur: x.type,
          Aciklama: x.note,
          Tutar: x.amount,
          Ekleyen: x.createdBy,
        }))
      ),
      "Gider"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        parts.map((x) => ({
          Tarih: formatDateForDisplay(x.date),
          Parca: x.part,
          Arac: x.car,
          Plaka: x.plate,
          Parcaci: supplierNameById(x.supplierId),
          Tutar: x.cost,
          Durum: x.paid ? "Ödendi" : "Ödenmedi",
          Ekleyen: x.createdBy,
        }))
      ),
      "Parca"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        employees.map((x) => ({
          Tarih: formatDateForDisplay(x.date),
          Eleman: x.employeeName,
          Aciklama: x.note,
          Tutar: x.amount,
          Ekleyen: x.createdBy,
        }))
      ),
      "Eleman"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        orders.map((x) => ({
          Tarih: formatDateForDisplay(x.date),
          Musteri: x.customer,
          Telefon: x.phone,
          Arac: x.car,
          Plaka: x.plate,
          Odeme: x.paymentStatus,
          MekanigeAktarildi: x.pushedToMechanic ? "Evet" : "Hayir",
          Toplam: x.grandTotal,
          Ekleyen: x.createdBy,
        }))
      ),
      "IsEmri"
    );

    XLSX.writeFile(
      wb,
      `orgunlar-finans-panel-${excelStart || "tum"}-${excelEnd || "tum"}.xlsx`
    );
  }

  function generateOrderPDFProfessional() {
    const doc = createPdfDoc(
      "ARAC IS EMRI",
      `Tarih: ${formatDateForDisplay(orderForm.date)}`
    );

    drawCard(doc, 12, 50, 58, 22, "Musteri", orderForm.customer || "-", "white");
    drawCard(doc, 76, 50, 58, 22, "Telefon", orderForm.phone || "-", "white");
    drawCard(doc, 140, 50, 58, 22, "Plaka", orderForm.plate || "-", "white");

    autoTable(doc, {
      startY: 80,
      head: [["Musteri Bilgileri", "Arac Bilgileri"]],
      body: [[
        pdfText(
          `Musteri: ${orderForm.customer || "-"}\nTelefon: ${orderForm.phone || "-"}\nAdres: ${
            orderForm.address || "-"
          }`
        ),
        pdfText(
          `Arac: ${orderForm.car || "-"}\nPlaka: ${orderForm.plate || "-"}\nSasi: ${
            orderForm.chassis || "-"
          }\nKM: ${orderForm.km || "-"}\nOdeme: ${orderForm.paymentStatus || "-"}`
        ),
      ]],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        valign: "top",
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [180, 20, 20],
        textColor: [255, 255, 255],
      },
      margin: { left: 12, right: 12 },
    });

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 100) + 8,
      head: [["Musteri Sikayetleri"]],
      body: [[pdfText(orderForm.complaints || "-")]],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 4,
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [40, 40, 40],
        textColor: [255, 255, 255],
      },
      margin: { left: 12, right: 12 },
    });

    const jobRows = orderForm.jobs
      .filter((job) => job.item || job.qty || job.price)
      .map((job, index) => [
        String(index + 1),
        pdfText(job.item || "-"),
        pdfText(job.qty || "-"),
        pdfText(job.price ? formatTRY(Number(job.price)) : "-"),
      ]);

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 130) + 8,
      head: [["#", "Yapilan Islem", "Adet", "Fiyat"]],
      body: jobRows.length ? jobRows : [["-", "Kayit yok", "-", "-"]],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        textColor: [25, 25, 25],
      },
      headStyles: {
        fillColor: [180, 20, 20],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      margin: { left: 12, right: 12 },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || 180) + 10;

    drawCard(doc, 88, finalY, 34, 22, "Iscilik", formatTRY(Number(orderForm.laborTotal || 0)), "white");
    drawCard(doc, 126, finalY, 34, 22, "Toplam", formatTRY(orderForm.jobs.reduce((s, j) => s + Number(j.price || 0), 0) + Number(orderForm.laborTotal || 0)), "white");
    drawCard(doc, 164, finalY, 34, 22, "Odeme", orderForm.paymentStatus, "white");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(pdfText("Yetkili: Ismail Orgun / Vahit Orgun"), 12, 282);
    doc.text(pdfText("ORGUNLAR GARAGE"), 198, 282, { align: "right" });

    doc.save(`orgunlar-is-emri-${pdfText(orderForm.plate || "rapor")}.pdf`);
  }

  const orderPartsTotal = orderForm.jobs.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const orderLaborTotal = Number(orderForm.laborTotal || 0);
  const orderGrandTotal = orderPartsTotal + orderLaborTotal;

  const tabs = [
    { key: "panel", label: "Panel" },
    { key: "mechanic", label: "Mekanik" },
    { key: "expertise", label: "Ekspertiz" },
    { key: "expenses", label: "Gider" },
    { key: "employees", label: "Eleman" },
    { key: "suppliers", label: "Parçacılar" },
    { key: "parts", label: "Parça" },
    { key: "vehicle", label: "Araç Takip" },
    { key: "order", label: "İş Emri" },
  ];

  if (!session) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(180,20,20,0.18),transparent_20%),linear-gradient(135deg,#050505_0%,#111217_45%,#200909_100%)] px-4 py-8 text-white md:px-8">
        <div className="mx-auto flex min-h-[90vh] max-w-5xl items-center justify-center">
          <div className="grid w-full gap-6 lg:grid-cols-2">
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-black via-zinc-950 to-red-950 p-8 shadow-2xl">
              <div className="mb-3 inline-flex rounded-full border border-red-500/20 bg-red-600/15 px-3 py-1 text-xs text-red-400">
                ORGUNLAR FİNANS PANEL
              </div>
              <h1 className="text-4xl font-black tracking-tight">Finans & Operasyon Takip Sistemi</h1>
              <p className="mt-4 text-zinc-400">Kullanıcı adı ve şifre ile giriş yap.</p>
              <div className="mt-4 text-xs text-zinc-500">Sürüm: {PANEL_VERSION}</div>
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(180,20,20,0.18),transparent_20%),linear-gradient(135deg,#050505_0%,#111217_45%,#200909_100%)] px-4 py-8 text-white md:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-white/10 bg-black/55 px-6 py-4 text-white">
            Veriler yükleniyor...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(180,20,20,0.18),transparent_20%),linear-gradient(135deg,#050505_0%,#111217_45%,#200909_100%)] px-4 py-5 text-white md:px-8">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/50 p-3 lg:flex-row lg:items-center">
          <div className="min-w-[240px] pl-2">
            <div className="text-xl font-black tracking-wide text-white">ORGUNLAR FİNANS PANEL</div>
            <div className="text-sm text-zinc-400">Haftalık Finans ve Operasyon Takibi</div>
            <div className="mt-1 text-[11px] text-zinc-500">{PANEL_VERSION}</div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:ml-auto lg:items-end">
            <div className="flex w-full gap-2 overflow-x-auto pb-2 lg:justify-end">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`shrink-0 rounded-xl px-4 py-3 text-sm transition ${
                    tab === item.key ? "bg-white text-black" : "bg-transparent text-zinc-300 hover:bg-white/5"
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
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-r from-black via-zinc-950 to-red-950 shadow-2xl">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-3 inline-flex rounded-full border border-red-500/20 bg-red-600/15 px-3 py-1 text-xs text-red-400">
                      ORGUNLAR FİNANS PANEL
                    </div>
                    <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                      Günlük / Haftalık / Aylık Özet
                    </h1>
                    <p className="mt-2 text-zinc-400">
                      Haftalar arasında geçiş yap, parçacı borçlarını gör, detaylı PDF ve Excel al.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                    <div className="text-sm text-zinc-400">Kira sonrası genel durum</div>
                    <div className="mt-2 text-3xl font-black text-white">{formatTRY(afterRent)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard title="Günlük Gelir" value={formatTRY(dailyIncome)} icon={<TrendingUp className="h-5 w-5" />} />
              <StatCard title="Günlük Gider" value={formatTRY(dailyExpense)} icon={<TrendingDown className="h-5 w-5" />} />
              <StatCard title="Haftalık Gelir" value={formatTRY(weeklyIncome)} icon={<Wallet className="h-5 w-5" />} />
              <StatCard title="Haftalık Gider" value={formatTRY(weeklyExpense)} icon={<Receipt className="h-5 w-5" />} />
              <StatCard title="Aylık Gelir" value={formatTRY(monthlyIncome)} icon={<BadgeDollarSign className="h-5 w-5" />} />
              <StatCard title="Aylık Gider" value={formatTRY(monthlyExpense)} icon={<Receipt className="h-5 w-5" />} />
            </div>

            <SectionCard
              icon={<FileText className="h-5 w-5" />}
              title="Haftalık Görünüm"
              desc={`${toDDMMYYYY(currentWeekRange.monday)} - ${toDDMMYYYY(currentWeekRange.saturday)}`}
              right={
                <div className="flex gap-2">
                  <button
                    onClick={() => setWeekOffset((prev) => prev - 1)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white transition hover:border-red-500/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setWeekOffset((prev) => prev + 1)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white transition hover:border-red-500/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              }
            >
              <div className="flex gap-6 overflow-x-auto pb-2">
                <div className="min-w-[720px] flex-1">
                  <WeeklyChart data={weeklyChartData} />
                </div>

                <div className="min-w-[360px] flex-1 space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                    <div className="text-lg font-bold text-white">Haftalık Özet</div>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-sm text-zinc-400">Haftalık gelir</div>
                        <div className="mt-1 text-2xl font-black text-white">{formatTRY(weeklyIncome)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-sm text-zinc-400">Haftalık gider</div>
                        <div className="mt-1 text-2xl font-black text-white">{formatTRY(weeklyExpense)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-sm text-zinc-400">Haftalık net kazanç</div>
                        <div className="mt-1 text-2xl font-black text-white">{formatTRY(weeklyNet)}</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={exportWeeklyPdfProfessional}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 font-medium text-white transition hover:bg-red-500 md:py-3"
                      >
                        <FileText className="h-4 w-4" />
                        Haftalık hesabı PDF aktar
                      </button>
                      <button
                        onClick={exportWeeklyExcel}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-medium text-white transition hover:bg-emerald-500 md:py-3"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Haftayı Excel aktar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SupplierDebtChart rows={supplierDebtRows} maxAmount={maxSupplierDebt} />

              <SectionCard
                icon={<Users className="h-5 w-5" />}
                title="Kişi Bazlı Haftalık Özet"
                desc="Toprak toplama dahil, paylaşıma dahil değil"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  {weeklyPersonStats.map((person) => (
                    <div key={person.key} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="text-lg font-bold text-white">{person.label}</div>
                      <div className="mt-3 text-sm text-zinc-400">Gelir</div>
                      <div className="text-xl font-black text-white">{formatTRY(person.income)}</div>
                      <div className="mt-3 text-sm text-zinc-400">Gider</div>
                      <div className="text-xl font-black text-white">{formatTRY(person.expense)}</div>
                      <div className="mt-3 text-sm text-zinc-400">Net</div>
                      <div className="text-xl font-black text-white">{formatTRY(person.net)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-lg font-bold text-white">Ortak Dağıtım</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="text-sm text-zinc-400">Kişi başı pay (İsmail + Vahit)</div>
                      <div className="mt-1 text-2xl font-black text-white">{formatTRY(equalShare)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="text-sm text-zinc-400">Toprak</div>
                      <div className="mt-1 text-base font-bold text-white">Toplama dahil, pay almaz</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="text-sm text-zinc-400">İsmail fark</div>
                      <div className="mt-1 text-xl font-black text-white">
                        {formatTRY(Math.abs(ismailDifference))}{" "}
                        {ismailDifference > 0 ? "alacaklı" : ismailDifference < 0 ? "fazla almış" : "eşit"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="text-sm text-zinc-400">Vahit fark</div>
                      <div className="mt-1 text-xl font-black text-white">
                        {formatTRY(Math.abs(vahitDifference))}{" "}
                        {vahitDifference > 0 ? "alacaklı" : vahitDifference < 0 ? "fazla almış" : "eşit"}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              icon={<Download className="h-5 w-5" />}
              title="Tüm Verileri Excel'e Aktar"
              desc="İstediğin tarih aralığını seç"
            >
              <div className="grid gap-3 md:grid-cols-[170px_170px_170px] lg:grid-cols-[170px_170px_220px_150px]">
                <SmallDateInput value={excelStart} onChange={setExcelStart} />
                <SmallDateInput value={excelEnd} onChange={setExcelEnd} />
                <button
                  onClick={exportAllDataExcel}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-medium text-white transition hover:bg-emerald-500 md:py-3"
                >
                  <Download className="h-4 w-4" />
                  Tüm bölümleri Excel aktar
                </button>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs text-zinc-400">Aylık sabit kira</div>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={rentForm}
                      onChange={(e) => setRentForm(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                    />
                    {isAdmin ? (
                      <button
                        onClick={updateRent}
                        className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white"
                      >
                        Kaydet
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {tab === "mechanic" && (
          <SectionCard icon={<Wrench className="h-5 w-5" />} title="Mekanik" desc="Araç işlem kayıtları">
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-10">
              <TextInput type="date" value={mechanicForm.date} onChange={(value) => setMechanicForm({ ...mechanicForm, date: value })} placeholder="Tarih" />
              <TextInput value={mechanicForm.car} onChange={(value) => setMechanicForm({ ...mechanicForm, car: value })} placeholder="Araç" />
              <TextInput value={mechanicForm.plate} onChange={(value) => setMechanicForm({ ...mechanicForm, plate: value })} placeholder="Plaka" />
              <TextInput value={mechanicForm.service} onChange={(value) => setMechanicForm({ ...mechanicForm, service: value })} placeholder="İşlem" />
              <TextInput value={mechanicForm.partCost} onChange={(value) => setMechanicForm({ ...mechanicForm, partCost: value })} placeholder="Parça maliyeti" />
              <SelectInput
                value={mechanicForm.partSupplierId}
                onChange={(value) => setMechanicForm({ ...mechanicForm, partSupplierId: value })}
                placeholder="Parça kimden alındı"
                options={data.suppliers.map((supplier) => ({
                  label: supplier.name,
                  value: String(supplier.id),
                }))}
              />
              <SelectInput
                value={mechanicForm.partPaymentStatus}
                onChange={(value) =>
                  setMechanicForm({
                    ...mechanicForm,
                    partPaymentStatus: value as "Ödendi" | "Ödenmedi",
                  })
                }
                placeholder="Parça ödeme"
                options={[
                  { label: "Ödendi", value: "Ödendi" },
                  { label: "Ödenmedi", value: "Ödenmedi" },
                ]}
              />
              <TextInput value={mechanicForm.labor} onChange={(value) => setMechanicForm({ ...mechanicForm, labor: value })} placeholder="İşçilik" />
              <TextInput value={mechanicForm.total} onChange={(value) => setMechanicForm({ ...mechanicForm, total: value })} placeholder="Toplam" />
              <div className="flex flex-col gap-2 md:flex-row">
                <button onClick={addMechanic} className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm">
                  {editingMechanicId ? "Güncelle" : "Kayıt ekle"}
                </button>
                {editingMechanicId && isAdmin ? (
                  <button onClick={resetMechanicForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                    İptal
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-3">
              <SmallDateInput value={mechanicFilter.start} onChange={(v) => setMechanicFilter((p) => ({ ...p, start: v }))} />
              <SmallDateInput value={mechanicFilter.end} onChange={(v) => setMechanicFilter((p) => ({ ...p, end: v }))} />
            </div>

            <DataTable
              headers={["Tarih", "Araç", "Plaka", "İşlem", "Parça", "Parçacı", "Durum", "İşçilik", "Toplam", "Ekleyen", "İşlem"]}
              rows={mechanicRows.map((item) => [
                formatDateForDisplay(item.date),
                item.car,
                item.plate,
                item.service,
                formatTRY(item.partCost),
                supplierNameById(item.partSupplierId),
                item.partPaymentStatus,
                formatTRY(item.labor),
                formatTRY(item.total),
                item.createdBy,
                <div key={item.id} className="flex gap-2">
                  <button onClick={() => editMechanic(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteMechanic(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                </div>,
              ])}
            />
          </SectionCard>
        )}

        {tab === "expertise" && (
          <SectionCard icon={<ClipboardCheck className="h-5 w-5" />} title="Ekspertiz" desc="Ekspertiz kayıtları">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
              <TextInput type="date" value={expertiseForm.date} onChange={(value) => setExpertiseForm({ ...expertiseForm, date: value })} placeholder="Tarih" />
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
              <div className="flex flex-col gap-2 md:flex-row">
                <button onClick={addExpertise} className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm">
                  {editingExpertiseId ? "Güncelle" : "Kayıt ekle"}
                </button>
                {editingExpertiseId && isAdmin ? (
                  <button onClick={resetExpertiseForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                    İptal
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 mt-4 flex flex-wrap gap-3">
              <SmallDateInput value={expertiseFilter.start} onChange={(v) => setExpertiseFilter((p) => ({ ...p, start: v }))} />
              <SmallDateInput value={expertiseFilter.end} onChange={(v) => setExpertiseFilter((p) => ({ ...p, end: v }))} />
            </div>

            <DataTable
              headers={["Tarih", "Araç", "Plaka", "Paket", "Ücret", "Ödeme", "Ekleyen", "İşlem"]}
              rows={expertiseRows.map((item) => [
                formatDateForDisplay(item.date),
                item.car,
                item.plate,
                item.packageType,
                formatTRY(item.fee),
                item.payment,
                item.createdBy,
                <div key={item.id} className="flex gap-2">
                  <button onClick={() => editExpertise(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteExpertise(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                </div>,
              ])}
            />
          </SectionCard>
        )}

        {tab === "expenses" && (
          <SectionCard icon={<Receipt className="h-5 w-5" />} title="Gider" desc="Gider kayıtları">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <TextInput value={expenseForm.date} onChange={(value) => setExpenseForm({ ...expenseForm, date: value })} placeholder="Tarih" type="date" />
              <TextInput value={expenseForm.type} onChange={(value) => setExpenseForm({ ...expenseForm, type: value })} placeholder="Tür" />
              <TextInput value={expenseForm.note} onChange={(value) => setExpenseForm({ ...expenseForm, note: value })} placeholder="Açıklama" />
              <TextInput value={expenseForm.amount} onChange={(value) => setExpenseForm({ ...expenseForm, amount: value })} placeholder="Tutar" />
              <div className="flex flex-col gap-2 md:flex-row">
                <button onClick={addExpense} className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm">
                  {editingExpenseId ? "Güncelle" : "Gider ekle"}
                </button>
                {editingExpenseId && isAdmin ? (
                  <button onClick={resetExpenseForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                    İptal
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 mt-4 flex flex-wrap gap-3">
              <SmallDateInput value={expenseFilter.start} onChange={(v) => setExpenseFilter((p) => ({ ...p, start: v }))} />
              <SmallDateInput value={expenseFilter.end} onChange={(v) => setExpenseFilter((p) => ({ ...p, end: v }))} />
            </div>

            <DataTable
              headers={["Tarih", "Tür", "Açıklama", "Tutar", "Ekleyen", "İşlem"]}
              rows={expenseRows.map((item) => [
                formatDateForDisplay(item.date),
                item.type,
                item.note,
                formatTRY(item.amount),
                item.createdBy,
                <div key={item.id} className="flex gap-2">
                  <button onClick={() => editExpense(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteExpense(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                </div>,
              ])}
            />
          </SectionCard>
        )}

        {tab === "employees" && (
          <SectionCard icon={<BadgeDollarSign className="h-5 w-5" />} title="Eleman Ödemeleri" desc="Maaş ve personel ödeme kayıtları">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <TextInput value={employeeForm.date} onChange={(value) => setEmployeeForm({ ...employeeForm, date: value })} placeholder="Tarih" type="date" />
              <TextInput value={employeeForm.employeeName} onChange={(value) => setEmployeeForm({ ...employeeForm, employeeName: value })} placeholder="Eleman adı" />
              <TextInput value={employeeForm.note} onChange={(value) => setEmployeeForm({ ...employeeForm, note: value })} placeholder="Açıklama" />
              <TextInput value={employeeForm.amount} onChange={(value) => setEmployeeForm({ ...employeeForm, amount: value })} placeholder="Tutar" />
              <div className="flex flex-col gap-2 md:flex-row">
                <button onClick={addEmployeePayment} className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm">
                  {editingEmployeeId ? "Güncelle" : "Ödeme ekle"}
                </button>
                {editingEmployeeId && isAdmin ? (
                  <button onClick={resetEmployeeForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                    İptal
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 mt-4 flex flex-wrap gap-3">
              <SmallDateInput value={employeeFilter.start} onChange={(v) => setEmployeeFilter((p) => ({ ...p, start: v }))} />
              <SmallDateInput value={employeeFilter.end} onChange={(v) => setEmployeeFilter((p) => ({ ...p, end: v }))} />
            </div>

            <DataTable
              headers={["Tarih", "Eleman", "Açıklama", "Tutar", "Ekleyen", "İşlem"]}
              rows={employeeRows.map((item) => [
                formatDateForDisplay(item.date),
                item.employeeName,
                item.note || "-",
                formatTRY(item.amount),
                item.createdBy,
                <div key={item.id} className="flex gap-2">
                  <button onClick={() => editEmployeePayment(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteEmployeePayment(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                </div>,
              ])}
            />
          </SectionCard>
        )}

        {tab === "suppliers" && (
          <SectionCard icon={<Users className="h-5 w-5" />} title="Parçacılar" desc="Parçacı ekleme ve listeleme">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <TextInput value={supplierForm.name} onChange={(value) => setSupplierForm({ ...supplierForm, name: value })} placeholder="Parçacı adı" />
              <TextInput value={supplierForm.phone} onChange={(value) => setSupplierForm({ ...supplierForm, phone: value })} placeholder="Telefon" />
              <TextInput value={supplierForm.note} onChange={(value) => setSupplierForm({ ...supplierForm, note: value })} placeholder="Not" />
              <div className="flex flex-col gap-2 md:col-span-2 md:flex-row">
                <button onClick={addSupplier} className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm">
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
                headers={["Parçacı", "Telefon", "Not", "Ekleyen", "İşlem"]}
                rows={data.suppliers.map((supplier) => [
                  supplier.name,
                  supplier.phone || "-",
                  supplier.note || "-",
                  supplier.createdBy,
                  <div key={supplier.id} className="flex gap-2">
                    <button onClick={() => editSupplier(supplier.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteSupplier(supplier.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                  </div>,
                ])}
              />
            </div>
          </SectionCard>
        )}

        {tab === "parts" && (
          <SectionCard icon={<Package className="h-5 w-5" />} title="Parça" desc="Parça kayıtları">
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
                  {formatTRY(partsRows.reduce((sum, item) => sum + item.cost, 0))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
              <TextInput type="date" value={partForm.date} onChange={(value) => setPartForm({ ...partForm, date: value })} placeholder="Tarih" />
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
                  { label: "Ödendi", value: "Ödendi" },
                  { label: "Ödenmedi", value: "Ödenmedi" },
                ]}
              />
              <div className="flex flex-col gap-2 md:flex-row">
                <button onClick={addPart} className="w-full rounded-2xl bg-red-600 px-4 py-4 text-base font-medium text-white transition hover:bg-red-500 md:py-3 md:text-sm">
                  {editingPartId ? "Güncelle" : "Parça ekle"}
                </button>
                {editingPartId && isAdmin ? (
                  <button onClick={resetPartForm} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white md:py-3">
                    İptal
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-4 mt-4 flex flex-wrap gap-3">
              <SmallDateInput value={partsFilter.start} onChange={(v) => setPartsFilter((p) => ({ ...p, start: v }))} />
              <SmallDateInput value={partsFilter.end} onChange={(v) => setPartsFilter((p) => ({ ...p, end: v }))} />
            </div>

            <DataTable
              headers={["Tarih", "Parça", "Araç", "Plaka", "Parçacı", "Tutar", "Durum", "Ekleyen", "İşlem"]}
              rows={partsRows.map((item) => [
                formatDateForDisplay(item.date),
                item.part,
                item.car,
                item.plate || "-",
                supplierNameById(item.supplierId),
                formatTRY(item.cost),
                item.paid ? "Ödendi" : "Ödenmedi",
                item.createdBy,
                <div key={item.id} className="flex gap-2">
                  <button onClick={() => editPart(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deletePart(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                </div>,
              ])}
            />
          </SectionCard>
        )}

        {tab === "vehicle" && (
          <SectionCard
            icon={<Car className="h-5 w-5" />}
            title="Araç Takip"
            desc="Plakaya göre tüm geçmiş"
            right={
              <div className="grid w-full grid-cols-1 gap-2 md:flex md:w-auto md:flex-wrap md:items-center">
                <SmallDateInput value={vehicleReportStart} onChange={setVehicleReportStart} />
                <SmallDateInput value={vehicleReportEnd} onChange={setVehicleReportEnd} />
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
                    formatDateForDisplay(item.date),
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
                    formatDateForDisplay(item.date),
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
                    formatDateForDisplay(item.date),
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
                  headers={["Tarih", "Müşteri", "Araç", "Plaka", "Ödeme", "Toplam"]}
                  rows={vehicleWorkOrderRows.map((item) => [
                    formatDateForDisplay(item.date),
                    item.customer,
                    item.car,
                    item.plate,
                    item.paymentStatus,
                    formatTRY(item.grandTotal),
                  ])}
                />
              </div>
            </div>
          </SectionCard>
        )}

        {tab === "order" && (
          <div className="space-y-6">
            <SectionCard icon={<FileText className="h-5 w-5" />} title="İş Emri" desc="İş emri oluştur, kaydet, güncelle, PDF al">
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
                    <TextInput type="date" value={orderForm.date} onChange={(value) => setOrderForm({ ...orderForm, date: value })} placeholder="Tarih" />
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
                      <button onClick={() => removeOrderJob(job.id)} className="rounded-2xl bg-red-600/10 p-3 text-red-600">
                        X
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-red-200 bg-zinc-50 p-4">
                    <div className="mb-2 text-sm font-semibold text-red-600">İşçilik</div>
                    <TextInput
                      value={orderForm.laborTotal}
                      onChange={(value) => setOrderForm({ ...orderForm, laborTotal: value })}
                      placeholder="İşçilik toplamı"
                    />
                  </div>

                  <div className="rounded-3xl border border-red-200 bg-zinc-50 p-4">
                    <div className="mb-2 text-sm font-semibold text-red-600">Ödeme Durumu</div>
                    <SelectInput
                      value={orderForm.paymentStatus}
                      onChange={(value) =>
                        setOrderForm({
                          ...orderForm,
                          paymentStatus: value as "Ödendi" | "Ödenmedi",
                        })
                      }
                      placeholder="Ödeme durumu"
                      options={[
                        { label: "Ödendi", value: "Ödendi" },
                        { label: "Ödenmedi", value: "Ödenmedi" },
                      ]}
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
                    onClick={generateOrderPDFProfessional}
                    className="rounded-2xl bg-red-600 px-5 py-4 font-medium text-white transition hover:bg-red-500 md:py-3"
                  >
                    PDF oluştur
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={<FileText className="h-5 w-5" />} title="Kayıtlı İş Emirleri" desc="Eski iş emirlerini görüntüle, ara, düzenle ve sil">
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
                    {formatTRY(workOrderRows.reduce((sum, item) => sum + item.grandTotal, 0))}
                  </span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <SmallDateInput value={workOrderFilter.start} onChange={(v) => setWorkOrderFilter((p) => ({ ...p, start: v }))} />
                <SmallDateInput value={workOrderFilter.end} onChange={(v) => setWorkOrderFilter((p) => ({ ...p, end: v }))} />
              </div>

              <DataTable
                headers={["Tarih", "Müşteri", "Araç", "Plaka", "Ödeme", "Toplam", "Ekleyen", "İşlem"]}
                rows={workOrderRows.map((item) => [
                  formatDateForDisplay(item.date),
                  item.customer,
                  item.car,
                  item.plate,
                  item.paymentStatus,
                  formatTRY(item.grandTotal),
                  item.createdBy,
                  <div key={item.id} className="flex gap-2">
                    <button onClick={() => editWorkOrder(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-white/10 text-white" : "bg-zinc-700/30 text-zinc-500"}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteWorkOrder(item.id)} className={`rounded-xl p-2 ${isAdmin ? "bg-red-600/20 text-red-300" : "bg-zinc-700/30 text-zinc-500"}`}><Trash2 className="h-4 w-4" /></button>
                  </div>,
                ])}
              />
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}