export type EmployeePlanId="employee_trial"|"employee_reception"|"employee_business"|"employee_team";

export type EmployeePlan={
  id:EmployeePlanId;
  name:string;
  priceAmd:number;
  employeeSeats:number;
  includedMinutes:number;
  concurrentCalls:number;
  maxCallMinutes:number;
  descriptionHy:string;
};

export const EMPLOYEE_PLANS:EmployeePlan[]=[
  {id:"employee_trial",name:"Trial",priceAmd:0,employeeSeats:1,includedMinutes:30,concurrentCalls:1,maxCallMinutes:8,descriptionHy:"Փորձարկեք մեկ հայկական AI աշխատակցի իրական բիզնես սցենարներով։"},
  {id:"employee_reception",name:"Reception",priceAmd:49900,employeeSeats:1,includedMinutes:150,concurrentCalls:1,maxCallMinutes:10,descriptionHy:"Մեկ 24/7 receptionist կամ dispatcher փոքր բիզնեսի համար։"},
  {id:"employee_business",name:"Business",priceAmd:99000,employeeSeats:2,includedMinutes:500,concurrentCalls:3,maxCallMinutes:12,descriptionHy:"Reception + sales/order workflows աճող բիզնեսի համար։"},
  {id:"employee_team",name:"Team",priceAmd:199000,employeeSeats:5,includedMinutes:1500,concurrentCalls:10,maxCallMinutes:15,descriptionHy:"Մի քանի AI աշխատակից, լոկացիա և զուգահեռ զանգեր թիմերի համար։"},
];

export function employeePlan(id:EmployeePlanId){return EMPLOYEE_PLANS.find(item=>item.id===id)||EMPLOYEE_PLANS[0];}
