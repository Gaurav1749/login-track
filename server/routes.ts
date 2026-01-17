import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { users, employees, rosters, attendance, passwordResetRequests } from "@shared/schema";
import { eq, and, gte, lte, sql, desc, isNull, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import * as XLSX from "xlsx";

const SessionStore = MemoryStore(session);
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "maersk-attendance-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000,
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!(req.session as any).userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await db.select().from(users).where(eq(users.id, (req.session as any).userId)).limit(1);
      if (user.length === 0) return res.status(404).json({ message: "User not found" });
      
      // Force session role to match database exactly (lowercase)
      (req.session as any).userRole = user[0].role.toLowerCase();
      
      res.json({ id: user[0].id, username: user[0].username, name: user[0].name, role: user[0].role });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const checkRole = (roles: string[]) => {
    return (req: Request, res: Response, next: any) => {
      const userRole = (req.session as any).userRole?.toLowerCase();
      const normalizedRoles = roles.map(r => r.toLowerCase());
      
      console.log(`Checking role: current=${userRole}, required=${normalizedRoles}`);
      
      if (!userRole || !normalizedRoles.includes(userRole)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      next();
    };
  };

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      
      if (user.length === 0) return res.status(401).json({ message: "Invalid credentials" });
      
      if (user[0].isLocked) {
        return res.status(403).json({ message: "Your account is locked. Please contact Admin." });
      }
      
      if (!user[0].isActive) return res.status(403).json({ message: "Account is inactive" });
      
      if (user[0].password !== password) {
        const newAttempts = (user[0].failedLoginAttempts || 0) + 1;
        const shouldLock = newAttempts >= 3;
        
        await db.update(users).set({
          failedLoginAttempts: newAttempts,
          isLocked: shouldLock
        }).where(eq(users.id, user[0].id));
        
        if (shouldLock) {
          return res.status(403).json({ message: "Your account is locked. Please contact Admin." });
        }
        
        return res.status(401).json({ message: `Invalid credentials. ${3 - newAttempts} attempt(s) remaining.` });
      }
      
      await db.update(users).set({ failedLoginAttempts: 0 }).where(eq(users.id, user[0].id));
      
      (req.session as any).userId = user[0].id;
      (req.session as any).userRole = user[0].role.toLowerCase();
      res.json({ 
        id: user[0].id, 
        username: user[0].username, 
        name: user[0].name, 
        role: user[0].role,
        mustChangePassword: user[0].mustChangePassword || false
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { username, password, name, role } = req.body;
      const newUser = await db.insert(users).values({
        id: randomUUID(), username, password, name, role, isActive: true
      }).returning();
      res.status(201).json(newUser[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, role, isActive, password } = req.body;
      const updateData: any = { name, role, isActive };
      if (password) updateData.password = password;
      const updated = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post("/api/users/:id/reset-password", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await db.update(users).set({
        password: "Welcome",
        isLocked: false,
        failedLoginAttempts: 0,
        mustChangePassword: true
      }).where(eq(users.id, id)).returning();
      
      if (updated.length === 0) return res.status(404).json({ message: "User not found" });
      res.json({ message: "Password reset to 'Welcome'. User must change password on next login." });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/users/:id/unlock", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await db.update(users).set({
        isLocked: false,
        failedLoginAttempts: 0
      }).where(eq(users.id, id)).returning();
      
      if (updated.length === 0) return res.status(404).json({ message: "User not found" });
      res.json({ message: "Account unlocked successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlock account" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Failed to logout" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Forgot Password - Request reset (public, no auth required)
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ message: "User ID is required" });
      
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User ID not found. Please contact administrator." });
      }
      
      // Check if there's already a pending request
      const existingRequest = await db.select().from(passwordResetRequests)
        .where(and(
          eq(passwordResetRequests.userId, user[0].id),
          eq(passwordResetRequests.status, "pending")
        )).limit(1);
      
      if (existingRequest.length > 0) {
        return res.status(400).json({ message: "A reset request is already pending. Please wait for Admin approval." });
      }
      
      await db.insert(passwordResetRequests).values({
        id: randomUUID(),
        userId: user[0].id,
        username: user[0].username,
        status: "pending"
      });
      
      res.json({ message: "Password reset request submitted. Please wait for Admin approval." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to submit reset request" });
    }
  });

  // Get all password reset requests (Admin only)
  app.get("/api/password-reset-requests", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const requests = await db.select().from(passwordResetRequests).orderBy(desc(passwordResetRequests.requestedAt));
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reset requests" });
    }
  });

  // Approve password reset request (Admin only)
  app.post("/api/password-reset-requests/:id/approve", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const request = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, id)).limit(1);
      
      if (request.length === 0) return res.status(404).json({ message: "Request not found" });
      if (request[0].status !== "pending") return res.status(400).json({ message: "Request already processed" });
      
      // Reset user password
      await db.update(users).set({
        password: "Welcome",
        isLocked: false,
        failedLoginAttempts: 0,
        mustChangePassword: true
      }).where(eq(users.id, request[0].userId));
      
      // Update request status
      await db.update(passwordResetRequests).set({
        status: "approved",
        resolvedAt: new Date(),
        resolvedBy: (req.session as any).userId
      }).where(eq(passwordResetRequests.id, id));
      
      res.json({ message: "Password reset approved. User's password is now 'Welcome'." });
    } catch (error) {
      res.status(500).json({ message: "Failed to approve reset request" });
    }
  });

  // Reject password reset request (Admin only)
  app.post("/api/password-reset-requests/:id/reject", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const request = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, id)).limit(1);
      
      if (request.length === 0) return res.status(404).json({ message: "Request not found" });
      if (request[0].status !== "pending") return res.status(400).json({ message: "Request already processed" });
      
      await db.update(passwordResetRequests).set({
        status: "rejected",
        resolvedAt: new Date(),
        resolvedBy: (req.session as any).userId
      }).where(eq(passwordResetRequests.id, id));
      
      res.json({ message: "Password reset request rejected." });
    } catch (error) {
      res.status(500).json({ message: "Failed to reject reset request" });
    }
  });

  // Delete a user (Admin only)
  app.delete("/api/users/:id", checkRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const currentUserId = (req.session as any).userId;
      
      if (id === currentUserId) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }
      
      await db.delete(users).where(eq(users.id, id));
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }
      
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) return res.status(404).json({ message: "User not found" });
      
      if (user[0].password !== currentPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      await db.update(users).set({ password: newPassword, mustChangePassword: false }).where(eq(users.id, userId));
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get("/api/dashboard/live", async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const allEmployees = await db.select().from(employees).where(eq(employees.isActive, true));
      const allRosters = await db.select().from(rosters);
      // Ensure we fetch all attendance records that don't have a gate out time, 
      // regardless of when they were created (to handle shifts crossing midnight)
      const liveAttendance = await db.select().from(attendance).where(isNull(attendance.gateOutTime)).orderBy(desc(attendance.gateInTime));
      const todayEntries = await db.select().from(attendance).where(eq(attendance.date, today));

      const liveManpower = liveAttendance.map((att) => {
        const emp = allEmployees.find(e => e.id === att.employeeId);
        const roster = allRosters.find(r => r.employeeId === att.employeeId);
        const gateInTime = new Date(att.gateInTime);
        const hoursWorked = (new Date().getTime() - gateInTime.getTime()) / (1000 * 60 * 60);
        return {
          id: emp?.id || att.employeeId,
          attendanceId: att.id,
          slpid: att.slpid,
          name: emp?.name || "Unknown",
          department: emp?.department || att.department || "",
          shiftName: roster?.shiftName || att.shiftName || "General",
          gender: emp?.gender || "",
          gateInTime: att.gateInTime.toISOString(),
          hoursWorked,
          isWeekOffEntry: att.isWeekOffEntry
        };
      });

      res.json({
        liveManpower,
        allEmployees,
        rosters: allRosters,
        todayEntryEmpIds: todayEntries.map(a => a.employeeId)
      });
    } catch (error) {
      console.error("Dashboard live error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.post("/api/gate/entry", async (req: Request, res: Response) => {
    try {
      const { slpid, allowWeekOff } = req.body;
      if (!slpid) return res.status(400).json({ message: "SLPID is required" });
      const employee = await db.select().from(employees).where(eq(employees.slpid, slpid.toUpperCase())).limit(1);
      if (employee.length === 0) return res.status(404).json({ message: "Employee not found" });
      if (!employee[0].isActive) return res.status(403).json({ message: "Employee is inactive" });
      
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();
      
      const activeEntry = await db.select().from(attendance).where(and(eq(attendance.employeeId, employee[0].id), isNull(attendance.gateOutTime))).limit(1);
      
      if (activeEntry.length > 0) {
        const gateInTime = new Date(activeEntry[0].gateInTime);
        const hoursElapsed = (now.getTime() - gateInTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursElapsed < 1) {
          return res.status(400).json({ 
            message: "Card already scanned", 
            action: "none",
            employeeName: employee[0].name,
            hoursElapsed: hoursElapsed.toFixed(2)
          });
        } else {
          const isOvertime = hoursElapsed >= 9;
          await db.update(attendance).set({ 
            gateOutTime: now, 
            isOvertime 
          }).where(eq(attendance.id, activeEntry[0].id));
          
          return res.json({ 
            success: true, 
            action: "gate_out",
            message: `Gate Out recorded - ${hoursElapsed.toFixed(1)} hours worked`, 
            employeeName: employee[0].name,
            hoursWorked: hoursElapsed.toFixed(1)
          });
        }
      }
      
      const roster = await db.select().from(rosters).where(eq(rosters.employeeId, employee[0].id)).limit(1);
      const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const isWeekOff = roster.length > 0 && roster[0].weekOff.toLowerCase() === dayOfWeek.toLowerCase();
      if (isWeekOff && !allowWeekOff) return res.status(409).json({ message: "Employee is on week off. Confirmation required.", isWeekOff: true, employeeName: employee[0].name });
      
      await db.insert(attendance).values({
        id: randomUUID(), employeeId: employee[0].id, slpid: employee[0].slpid,
        shiftName: roster.length > 0 ? roster[0].shiftName : "General",
        department: employee[0].department, isWeekOffEntry: isWeekOff && allowWeekOff,
        isOvertime: false, date: today,
      });
      
      res.json({ 
        success: true, 
        action: "gate_in",
        message: "Gate In recorded successfully", 
        employeeName: employee[0].name 
      });
    } catch (error) {
      console.error("Entry error:", error);
      res.status(500).json({ message: "Failed to record entry" });
    }
  });

  app.get("/api/gate/present", async (req: Request, res: Response) => {
    try {
      const activeEntries = await db.select().from(attendance).where(isNull(attendance.gateOutTime)).orderBy(desc(attendance.gateInTime));
      const result = await Promise.all(activeEntries.map(async (att) => {
        const emp = await db.select().from(employees).where(eq(employees.id, att.employeeId)).limit(1);
        const gateInTime = new Date(att.gateInTime);
        const now = new Date();
        const hoursWorked = (now.getTime() - gateInTime.getTime()) / (1000 * 60 * 60);
        return {
          id: emp[0]?.id || "", attendanceId: att.id, slpid: att.slpid,
          name: emp[0]?.name || "Unknown", department: att.department || "",
          shift: att.shiftName || "General", gateInTime: att.gateInTime.toISOString(),
          hoursWorked: Math.max(0, hoursWorked), date: att.date,
        };
      }));
      res.json(result);
    } catch (error) {
      console.error("Present employees error:", error);
      res.status(500).json({ message: "Failed to fetch present employees" });
    }
  });

  app.post("/api/gate/bulk-out", async (req: Request, res: Response) => {
    try {
      const { attendanceIds } = req.body;
      if (!attendanceIds || !Array.isArray(attendanceIds) || attendanceIds.length === 0) return res.status(400).json({ message: "No attendance IDs provided" });
      const now = new Date();
      let count = 0;
      for (const attId of attendanceIds) {
        const att = await db.select().from(attendance).where(eq(attendance.id, attId)).limit(1);
        if (att.length > 0) {
          const gateInTime = new Date(att[0].gateInTime);
          const hoursWorked = (now.getTime() - gateInTime.getTime()) / (1000 * 60 * 60);
          await db.update(attendance).set({ gateOutTime: now, isOvertime: hoursWorked >= 9 }).where(eq(attendance.id, attId));
          count++;
        }
      }
      res.json({ success: true, count, message: `${count} employees marked as Gate Out` });
    } catch (error) {
      console.error("Bulk gate out error:", error);
      res.status(500).json({ message: "Failed to process bulk gate out" });
    }
  });

  app.get("/api/employees", checkRole(["admin", "manager", "mis"]), async (req: Request, res: Response) => {
    try {
      const allEmployees = await db.select().from(employees).orderBy(desc(employees.createdAt));
      res.json(allEmployees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", checkRole(["admin", "manager", "mis"]), async (req: Request, res: Response) => {
    try {
      const { name, slpid, employeeId, gender, department, designation, dateOfJoining, isActive, weekOff, shiftName } = req.body;
      const existing = await db.select().from(employees).where(eq(employees.slpid, slpid.toUpperCase())).limit(1);
      if (existing.length > 0) return res.status(400).json({ message: "Employee with this SLPID already exists" });
      const newEmployee = await db.insert(employees).values({
        id: randomUUID(), slpid: slpid.toUpperCase(), employeeId: employeeId.toUpperCase(),
        name, gender, department, designation: designation || "Associate",
        dateOfJoining, isActive: isActive ?? true,
      }).returning();

      await db.insert(rosters).values({
        id: randomUUID(), employeeId: newEmployee[0].id, slpid: newEmployee[0].slpid,
        employeeName: newEmployee[0].name, gender: newEmployee[0].gender,
        department: newEmployee[0].department, designation: newEmployee[0].designation || "Associate",
        shiftName: shiftName || "General", weekOff: weekOff || "Sunday", effectiveDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(newEmployee[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", checkRole(["admin", "manager", "mis"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, gender, department, designation, isActive } = req.body;
      const updated = await db.update(employees).set({ name, gender, department, designation, isActive }).where(eq(employees.id, id)).returning();
      if (updated.length === 0) return res.status(404).json({ message: "Employee not found" });
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.get("/api/rosters/download", checkRole(["admin", "manager", "mis"]), async (req: Request, res: Response) => {
    try {
      const allRosters = await db.select().from(rosters).orderBy(desc(rosters.createdAt));
      const downloadData = allRosters.map(r => ({
        "SLPID": r.slpid,
        "Employee Name": r.employeeName,
        "Gender": r.gender,
        "Department": r.department,
        "Designation": r.designation,
        "Shift Name": r.shiftName,
        "Week Off": r.weekOff,
        "Effective Date": r.effectiveDate,
      }));
      const worksheet = XLSX.utils.json_to_sheet(downloadData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Roster");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=roster_export.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Download roster error:", error);
      res.status(500).json({ message: "Failed to download roster" });
    }
  });

  app.get("/api/rosters", async (req: Request, res: Response) => {
    try {
      const allRosters = await db.select().from(rosters).orderBy(desc(rosters.createdAt));
      res.json(allRosters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rosters" });
    }
  });

  app.put("/api/rosters/:id", checkRole(["admin", "manager", "mis"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { shiftName, weekOff } = req.body;
      const updated = await db.update(rosters).set({ shiftName, weekOff, updatedAt: new Date() }).where(eq(rosters.id, id)).returning();
      if (updated.length === 0) return res.status(404).json({ message: "Roster not found" });
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to update roster" });
    }
  });

  app.post("/api/rosters/upload", checkRole(["admin", "manager", "mis"]), upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      if (data.length === 0) return res.status(400).json({ message: "Excel file is empty" });
      let created = 0, updated = 0;
      for (const row of data as any[]) {
        const slpid = String(row.SLPID || row.slpid || "").toUpperCase().trim();
        const name = String(row.Name || row.name || row["Employee Name"] || "").trim();
        if (!slpid || !name) continue;
        
        let doj = row["Date of Joining"];
        if (doj instanceof Date) {
          doj = doj.toISOString().split("T")[0];
        } else if (typeof doj === "number") {
          const date = new Date((doj - 25569) * 86400 * 1000);
          doj = date.toISOString().split("T")[0];
        } else {
          doj = doj || new Date().toISOString().split("T")[0];
        }

        let employee = await db.select().from(employees).where(eq(employees.slpid, slpid)).limit(1);
        if (employee.length === 0) {
          const newEmp = await db.insert(employees).values({
            id: randomUUID(), slpid, 
            employeeId: String(row["Employee ID"] || slpid).toUpperCase().trim(),
            name, gender: String(row.Gender || "Male").trim(), 
            department: String(row.Department || "Inbound").trim(),
            designation: String(row.Designation || "Associate").trim(), 
            dateOfJoining: doj, isActive: true,
            addedVia: "roster",
          }).returning();
          employee = newEmp;
          created++;
        } else {
          await db.update(employees).set({
            name,
            gender: String(row.Gender || employee[0].gender).trim(),
            department: String(row.Department || employee[0].department).trim(),
            designation: String(row.Designation || employee[0].designation).trim(),
            dateOfJoining: doj
          }).where(eq(employees.id, employee[0].id));
        }

        const existingRoster = await db.select().from(rosters).where(eq(rosters.employeeId, employee[0].id)).limit(1);
        if (existingRoster.length > 0) {
          await db.update(rosters).set({ 
            shiftName: String(row["Shift Name"] || row.Shift || "General").trim(), 
            weekOff: String(row["Week Off"] || "Sunday").trim(), 
            updatedAt: new Date() 
          }).where(eq(rosters.id, existingRoster[0].id));
          updated++;
        } else {
          await db.insert(rosters).values({
            id: randomUUID(), employeeId: employee[0].id, slpid, 
            employeeName: name, gender: employee[0].gender, 
            department: employee[0].department, designation: employee[0].designation, 
            shiftName: String(row["Shift Name"] || row.Shift || "General").trim(), 
            weekOff: String(row["Week Off"] || "Sunday").trim(), 
            effectiveDate: new Date().toISOString().split("T")[0],
          });
          created++;
        }
      }
      res.json({ success: true, message: `Upload complete. Created: ${created}, Updated: ${updated}` });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to process upload: " + error.message });
    }
  });

  app.get("/api/rosters/template", (req: Request, res: Response) => {
    const template = [{ SLPID: "SLP001", "Employee Name": "John Doe", Gender: "Male", "Employee ID": "EMP001", Department: "Inbound", Designation: "Associate", "Date of Joining": "2024-01-15", "Shift Name": "Shift A", "Week Off": "Sunday" }];
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roster Template");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=roster_template.xlsx");
    res.send(buffer);
  });

  app.delete("/api/rosters", checkRole(["admin", "manager", "mis"]), async (req: Request, res: Response) => {
    try {
      await db.delete(attendance);
      await db.delete(rosters);
      await db.delete(employees);
      res.json({ success: true, message: "All roster records and employees have been deleted" });
    } catch (error) {
      console.error("Delete roster error:", error);
      res.status(500).json({ message: "Failed to delete roster" });
    }
  });

  app.get("/api/reports", async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate, department, onlyAbsent } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ message: "Dates required" });

      const allEmp = await db.select().from(employees).where(eq(employees.isActive, true));
      const allRos = await db.select().from(rosters);
      const allAtt = await db.select().from(attendance).where(and(gte(attendance.date, fromDate as string), lte(attendance.date, toDate as string)));
      
      const dates: string[] = [];
      for (let d = new Date(fromDate as string); d <= new Date(toDate as string); d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }

      const records: any[] = [];
      allEmp.forEach(emp => {
        if (department && emp.department !== department) return;
        const ros = allRos.find(r => r.employeeId === emp.id);
        
        dates.forEach(date => {
          const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
          const isWeekOff = ros?.weekOff?.toLowerCase() === dayOfWeek.toLowerCase();
          const att = allAtt.find(a => a.employeeId === emp.id && a.date === date);
          
          if (onlyAbsent === "true") {
            if (!isWeekOff && !att) {
              records.push({
                id: randomUUID(), slpid: emp.slpid, employeeName: emp.name,
                employeeIdCode: emp.employeeId, gender: emp.gender,
                department: emp.department, designation: emp.designation,
                weekOff: ros?.weekOff || "", dateOfJoining: emp.dateOfJoining,
                date: date, gateInTime: "", gateOutTime: null,
                shiftName: ros?.shiftName || "General", totalHours: "0.00",
                otHours: "0.00", status: "A"
              });
            }
          } else {
            if (att) {
              const gateInTime = new Date(att.gateInTime);
              const gateOutTime = att.gateOutTime ? new Date(att.gateOutTime) : null;
              const totalHours = gateOutTime ? (gateOutTime.getTime() - gateInTime.getTime()) / (1000 * 60 * 60) : 0;
              records.push({
                id: att.id, slpid: att.slpid, employeeName: emp.name,
                employeeIdCode: emp.employeeId, gender: emp.gender,
                department: att.department, designation: emp.designation,
                weekOff: ros?.weekOff || "", dateOfJoining: emp.dateOfJoining,
                date: att.date, gateInTime: att.gateInTime.toISOString(),
                gateOutTime: att.gateOutTime?.toISOString() || null,
                shiftName: att.shiftName, totalHours: totalHours.toFixed(2),
                otHours: (totalHours > 9 ? totalHours - 9 : 0).toFixed(2), status: "P"
              });
            } else if (!isWeekOff) {
              records.push({
                id: randomUUID(), slpid: emp.slpid, employeeName: emp.name,
                employeeIdCode: emp.employeeId, gender: emp.gender,
                department: emp.department, designation: emp.designation,
                weekOff: ros?.weekOff || "", dateOfJoining: emp.dateOfJoining,
                date: date, gateInTime: "", gateOutTime: null,
                shiftName: ros?.shiftName || "General", totalHours: "0.00",
                otHours: "0.00", status: "A"
              });
            }
          }
        });
      });

      res.json(records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("Reports error:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/new-joiners", checkRole(["admin", "manager", "mis", "supervisor"]), async (req: Request, res: Response) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
      const newJoiners = await db.select().from(employees).where(and(eq(employees.isActive, true), eq(employees.addedVia, "manual"), gte(employees.dateOfJoining, sevenDaysAgoStr))).orderBy(desc(employees.dateOfJoining));
      const allRos = await db.select().from(rosters);
      const result = newJoiners.map(emp => {
        const ros = allRos.find(r => r.employeeId === emp.id);
        return {
          id: emp.id, name: emp.name, gender: emp.gender, slpid: emp.slpid,
          employeeId: emp.employeeId, department: emp.department,
          shiftName: ros?.shiftName || "General", dateOfJoining: emp.dateOfJoining
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch new joiners" });
    }
  });

  app.get("/api/reports/export-new-joiners", async (req: Request, res: Response) => {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 8); // Start from 8 days ago
      const endDate = new Date();
      endDate.setDate(today.getDate() - 1); // End at yesterday

      const fromDateStr = sevenDaysAgo.toISOString().split("T")[0];
      const toDateStr = endDate.toISOString().split("T")[0];

      // Fetch employees who joined in the last 7 days (manual entries)
      const newJoiners = await db.select().from(employees).where(
        and(
          eq(employees.isActive, true), 
          eq(employees.addedVia, "manual"), 
          gte(employees.dateOfJoining, fromDateStr),
          lte(employees.dateOfJoining, toDateStr)
        )
      ).orderBy(desc(employees.dateOfJoining));

      const allRos = await db.select().from(rosters);
      const allAtt = await db.select().from(attendance).where(
        and(gte(attendance.date, fromDateStr), lte(attendance.date, toDateStr))
      );

      const dates: string[] = [];
      for (let d = new Date(fromDateStr); d <= new Date(toDateStr); d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }

      const reportData = newJoiners.map(emp => {
        const ros = allRos.find(r => r.employeeId === emp.id);
        const row: any = { 
          "Name": emp.name, 
          "Gender": emp.gender, 
          "SLPID": emp.slpid, 
          "Employee ID": emp.employeeId, 
          "Department": emp.department, 
          "Shift": ros?.shiftName || "General", 
          "Date of Joining": emp.dateOfJoining 
        };

        dates.forEach(date => {
          const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
          const isWeekOff = ros?.weekOff?.toLowerCase() === dayOfWeek.toLowerCase();
          const att = allAtt.find(a => a.employeeId === emp.id && a.date === date);
          
          const [y, m, d] = date.split("-");
          const formattedDate = `${d}-${m}-${y}`;
          row[formattedDate] = att ? "P" : (isWeekOff ? "WO" : "A");
        });

        return row;
      });

      const buffer = XLSX.write({ 
        SheetNames: ["New Joiners P-A Summary"], 
        Sheets: { "New Joiners P-A Summary": XLSX.utils.json_to_sheet(reportData) } 
      }, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=new_joiners_pa_summary_${fromDateStr}_to_${toDateStr}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export new joiners error:", error);
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/reports/export-absent", async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate, department } = req.query;
      const allEmp = await db.select().from(employees).where(eq(employees.isActive, true));
      const allRos = await db.select().from(rosters);
      const allAtt = await db.select().from(attendance).where(and(gte(attendance.date, fromDate as string), lte(attendance.date, toDate as string)));
      const dates: string[] = [];
      for (let d = new Date(fromDate as string); d <= new Date(toDate as string); d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }
      const report: any[] = [];
      allEmp.forEach(emp => {
        if (department && emp.department !== department) return;
        const ros = allRos.find(r => r.employeeId === emp.id);
        dates.forEach(date => {
          const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
          const isWeekOff = ros?.weekOff?.toLowerCase() === dayOfWeek.toLowerCase();
          const hasAtt = allAtt.some(a => a.employeeId === emp.id && a.date === date);
          if (!isWeekOff && !hasAtt) {
            report.push({ "Name": emp.name, "Gender": emp.gender, "SLPID": emp.slpid, "Employee ID": emp.employeeId, "Department": emp.department, "Designation": emp.designation, "Week Off": ros?.weekOff || "", "Date of Joining": emp.dateOfJoining, "Absent Date": date, "Attendance Status": "A" });
          }
        });
      });
      const buffer = XLSX.write({ SheetNames: ["Absents"], Sheets: { "Absents": XLSX.utils.json_to_sheet(report) } }, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=absent_report_${fromDate}_to_${toDate}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/reports/export", async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate, department, onlyAbsent } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ message: "Dates required" });
      let allEmp = await db.select().from(employees).where(eq(employees.isActive, true));
      if (department) allEmp = allEmp.filter(e => e.department === department);
      const allRos = await db.select().from(rosters);
      const allAtt = await db.select().from(attendance).where(and(gte(attendance.date, fromDate as string), lte(attendance.date, toDate as string)));
      const dates: string[] = [];
      for (let d = new Date(fromDate as string); d <= new Date(toDate as string); d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }
      if (onlyAbsent === "true") {
        const report: any[] = [];
        allEmp.forEach(emp => {
          const ros = allRos.find(r => r.employeeId === emp.id);
          
          dates.forEach(d => {
            const dayOfWeek = new Date(d).toLocaleDateString("en-US", { weekday: "long" });
            const isWeekOff = ros?.weekOff?.toLowerCase() === dayOfWeek.toLowerCase();
            const att = allAtt.find(a => a.employeeId === emp.id && a.date === d);
            
            if (!isWeekOff && !att) {
              report.push({
                "SLPID": emp.slpid,
                "Employee Name": emp.name,
                "Employee ID": emp.employeeId,
                "Gender": emp.gender,
                "Department": emp.department,
                "Designation": emp.designation,
                "Date of Joining": emp.dateOfJoining,
                "Shift": ros?.shiftName || "General",
                "Week Off": ros?.weekOff || "",
                "Date": d,
                "Gate In Date": "--/--/----",
                "Gate In Time": "--:--",
                "Gate Out Time": "--:--",
                "Total Hours": "0.00",
                "OT Hours": "0.00",
                "Status": "A"
              });
            }
          });
        });
        const buffer = XLSX.write({ SheetNames: ["Absents"], Sheets: { "Absents": XLSX.utils.json_to_sheet(report) } }, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=absent_report_${fromDate}_to_${toDate}.xlsx`);
        res.send(buffer);
        return;
      }
      const report = allEmp.map(emp => {
        const ros = allRos.find(r => r.employeeId === emp.id);
        const atts = allAtt.filter(a => a.employeeId === emp.id);
        const row: any = { 
          "Name": emp.name, 
          "Gender": emp.gender, 
          "SLPID": emp.slpid, 
          "Employee ID": emp.employeeId, 
          "Department": emp.department, 
          "Designation": emp.designation, 
          "Shift": ros?.shiftName || "General",
          "Week Off": ros?.weekOff || "", 
          "Date of Joining": emp.dateOfJoining 
        };
        dates.forEach(d => {
          const dayOfWeek = new Date(d).toLocaleDateString("en-US", { weekday: "long" });
          const isWeekOff = ros?.weekOff?.toLowerCase() === dayOfWeek.toLowerCase();
          const att = atts.find(a => a.date === d);
          row[d] = att ? "P" : (isWeekOff ? "WO" : "A");
        });
        row["Total Present"] = dates.filter(d => row[d] === "P").length;
        return row;
      });
      const buffer = XLSX.write({ SheetNames: ["Attendance"], Sheets: { "Attendance": XLSX.utils.json_to_sheet(report) } }, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=attendance_${fromDate}_to_${toDate}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export failed:", error);
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/reports/export-detailed", async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate, department } = req.query;
      const atts = await db.select().from(attendance).where(and(gte(attendance.date, fromDate as string), lte(attendance.date, toDate as string)));
      const emps = await db.select().from(employees);
      const allRos = await db.select().from(rosters);
      const reportData = atts.filter(a => !department || a.department === department).map(a => {
        const emp = emps.find(e => e.id === a.employeeId);
        const ros = allRos.find(r => r.employeeId === a.employeeId);
        const inT = new Date(a.gateInTime);
        const outT = a.gateOutTime ? new Date(a.gateOutTime) : null;
        const hrs = outT ? (outT.getTime() - inT.getTime()) / (1000 * 60 * 60) : 0;
        return { 
          "SLPID": a.slpid, 
          "Employee ID": emp?.employeeId || "-", 
          "Name": emp?.name || "Unknown", 
          "Department": a.department || "-", 
          "Shift (A / B / C)": a.shiftName || "-", 
          "Gate In Date": inT.toLocaleDateString("en-GB"),
          "Check-In Time": inT.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }), 
          "Check-Out Time": outT ? outT.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "", 
          "Week Off Present (Yes / No)": a.isWeekOffEntry ? "Yes" : "No", 
          "Working Hours": hrs.toFixed(2), 
          "OT Hours": (hrs > 9 ? hrs - 9 : 0).toFixed(2) 
        };
      });
      const buffer = XLSX.write({ SheetNames: ["Detailed Attendance"], Sheets: { "Detailed Attendance": XLSX.utils.json_to_sheet(reportData) } }, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=detailed_attendance_${fromDate}_to_${toDate}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Detailed export failed:", error);
      res.status(500).json({ message: "Export failed" });
    }
  });

  return createServer(app);
}
