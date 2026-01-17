import { db } from "./db";
import { users, employees, rosters } from "@shared/schema";
import { randomUUID } from "crypto";

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("Database already seeded");
    return;
  }

  const adminId = randomUUID();
  const supervisorId = randomUUID();

  await db.insert(users).values([
    {
      id: adminId,
      username: "admin",
      password: "admin123",
      name: "System Administrator",
      role: "admin",
      isActive: true,
    },
    {
      id: supervisorId,
      username: "supervisor",
      password: "super123",
      name: "John Supervisor",
      role: "supervisor",
      isActive: true,
    },
  ]);

  console.log("Created demo users:");
  console.log("  Admin: username=admin, password=admin123");
  console.log("  Supervisor: username=supervisor, password=super123");

  const employeeData = [
    { name: "Rahul Kumar", slpid: "SLP001", employeeId: "EMP001", gender: "Male", department: "Inbound", dateOfJoining: "2023-01-15" },
    { name: "Priya Sharma", slpid: "SLP002", employeeId: "EMP002", gender: "Female", department: "Outbound", dateOfJoining: "2023-02-20" },
    { name: "Amit Singh", slpid: "SLP003", employeeId: "EMP003", gender: "Male", department: "Returns", dateOfJoining: "2023-03-10" },
    { name: "Sneha Patel", slpid: "SLP004", employeeId: "EMP004", gender: "Female", department: "Inventory", dateOfJoining: "2023-04-05" },
    { name: "Vikram Yadav", slpid: "SLP005", employeeId: "EMP005", gender: "Male", department: "VNA", dateOfJoining: "2023-05-12" },
    { name: "Anita Desai", slpid: "SLP006", employeeId: "EMP006", gender: "Female", department: "Inbound", dateOfJoining: "2023-06-18" },
    { name: "Rajesh Gupta", slpid: "SLP007", employeeId: "EMP007", gender: "Male", department: "Outbound", dateOfJoining: "2023-07-22" },
    { name: "Kavita Nair", slpid: "SLP008", employeeId: "EMP008", gender: "Female", department: "Returns", dateOfJoining: "2023-08-30" },
  ];

  const shifts = ["Morning", "Evening", "Night", "General"];
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let i = 0; i < employeeData.length; i++) {
    const emp = employeeData[i];
    const empId = randomUUID();

    await db.insert(employees).values({
      id: empId,
      name: emp.name,
      slpid: emp.slpid,
      employeeId: emp.employeeId,
      gender: emp.gender,
      department: emp.department,
      dateOfJoining: emp.dateOfJoining,
      isActive: true,
    });

    await db.insert(rosters).values({
      id: randomUUID(),
      employeeId: empId,
      slpid: emp.slpid,
      employeeName: emp.name,
      department: emp.department,
      shiftName: shifts[i % shifts.length],
      weekOff: weekDays[i % weekDays.length],
      effectiveDate: new Date().toISOString().split("T")[0],
    });
  }

  console.log(`Created ${employeeData.length} demo employees with rosters`);
  console.log("Seeding complete!");
}

seed()
  .catch((error) => {
    console.error("Seeding error:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
