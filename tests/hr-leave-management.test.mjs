import test from "node:test";
import assert from "node:assert/strict";
import { parseLeaveAmount, parseLeaveHireDate, previewLeaveImport } from "../lib/hr/leave-import.ts";

const staff = [
  {id:"00005",full_name:"Aytekin Darbaz",is_active:true,employment_date:"2026-10-02",leave_balance:14},
  {id:"12345",full_name:"Örnek Personel",is_active:true,employment_date:"2025-03-01",leave_balance:-2},
  {id:"67890",full_name:"Pasif Personel",is_active:false,employment_date:"2024-01-01",leave_balance:8},
];
const row=(id,name,balance,date)=>({
  "PERSONEL ID":id,"PERSONEL ADI SOYADI":name,
  "KALAN İZİN (DÜZENLE)":balance,"İŞE GİRİŞ TARİHİ":date,
});

test("leading-zero ID survives Excel numeric coercion",()=>{
  const result=previewLeaveImport([row(5,"Aytekin Darbaz",12,"2026-10-02")],staff);
  assert.equal(result.issues.length,0);
  assert.equal(result.changes[0].employee.id,"00005");
  assert.equal(result.changes[0].newBalance,12);
});

test("blank balance is never interpreted as zero",()=>{
  const result=previewLeaveImport([row("12345","Örnek Personel",null,"2025-03-01")],staff);
  assert.equal(result.changes.length,0);
  assert.equal(result.issues.length,1);
  assert.ok(Number.isNaN(parseLeaveAmount("")));
});

test("negative balance -14 accepted but lower rejected",()=>{
  assert.equal(previewLeaveImport([row("12345","Örnek Personel",-14,"")],staff).changes.length,1);
  assert.equal(previewLeaveImport([row("12345","Örnek Personel",-14.01,"")],staff).issues.length,1);
});

test("duplicate IDs abort the batch preview",()=>{
  const result=previewLeaveImport([
    row("12345","Örnek Personel",1,""),
    row("12345","Örnek Personel",2,""),
  ],staff);
  assert.equal(result.issues.length,1);
});

test("name mismatch and non-scoped ID are rejected",()=>{
  assert.equal(previewLeaveImport([row("12345","Başka Personel",3,"")],staff).issues.length,1);
  assert.equal(previewLeaveImport([row("99999","Başka Personel",3,"")],staff).issues.length,1);
});

test("inactive employees cannot receive changes",()=>{
  assert.equal(previewLeaveImport([row("67890","Pasif Personel",5,"")],staff).issues.length,1);
});

test("unchanged rows are omitted while employment-date changes are recorded",()=>{
  assert.equal(previewLeaveImport([row("12345","Örnek Personel",-2,"2025-03-01")],staff).changes.length,0);
  assert.equal(previewLeaveImport([row("12345","Örnek Personel",-2,"2025-03-02")],staff).changes.length,1);
});

test("date parsing rejects nonexistent days and accepts Turkish format",()=>{
  assert.equal(parseLeaveHireDate("29.02.2026"),null);
  assert.equal(parseLeaveHireDate("02.10.2026"),"2026-10-02");
  assert.equal(parseLeaveAmount("1,5"),1.5);
});
