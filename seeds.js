/* StudyOS trimester seed data — parsed from the official module lists (Sep 2026).
   Videos + Optimization practice sets only (no slide readings — textbook time
   lives in per-module reading minutes). Excluded: discussion prompts, 3–4h lab
   recordings (covered by the Sat live-lab block), live-class recordings
   (halted), and the graded tests themselves (in SEED_TESTS below). */
"use strict";
const SEED_MODULES = [
{ course:"RDBMS", week:1, title:"About the Course, Intro to DBMS & Relational Model", videos:[
["About the Course",11],["Purpose of Database Systems",7],["Drawbacks of File Systems",11],
["Data Abstractions",5],["Data Model",5],["Relation Data Model",6],["DDL and DML",7],
["SQL Query Language",5],["History of Database Systems and Conclusion",7],["Learning Objectives & Recap",3],
["Relation Schema and Relational Database",8],["Super key, Candidate key, Primary key",9],
["Foreign key, Foreign key constraint",7],["Database Schema Diagram & Conclusion",6],

]},
{ course:"RDBMS", week:2, title:"Introduction to Relational Algebra", videos:[
["Relational Query Language",8],["Select Operation",11],["Project Operation",4],
["Composition of Relational Operations",4],["Cartesian Product Operation",5],["Natural Join Operation",13],
["Outer Join Operation",6],["Union Operation",5],["Intersection Operation",2],["Set-Difference Operation",3],
["Assignment Operation",5],["Rename Operation",9],["Equivalent Queries & Conclusion",10],

]},
{ course:"RDBMS", week:3, title:"Introduction to SQL - Part 1", videos:[
["Learning Objectives & Recap",10],["Overview of SQL",6],["Basic Domain Types in SQL",12],
["Create Table",12],["Insert Record into Table",7],["Basic SQL Query Structure",5],["SELECT Clause",11],
["WHERE Clause",5],["FROM Clause",7],["Rename Operation",5],["String Operation",7],
["Ordering the Tuples to Display",4],["Set Operations",5],["Null Values",5],["Basic Aggregate Functions",14],

]},
{ course:"RDBMS", week:4, title:"Introduction to SQL - Part 2, Intermediate SQL - Part 1", videos:[
["Nested Subqueries - Set Membership",7],["Set Comparison",6],["Test for Existence of Relations",10],
["Test for Duplicate Tuples",5],["Subqueries in FROM & SELECT Clause",11],["Insert Record into Database",8],
["Delete Tuple",7],["Update Tuple & Conclusion",13],["Recap & Natural Join Operation",10],
["Issues in Natural Join",7],["Join Condition - On Clause",6],["Outer Join Operation",6],
["Outer Join with ON Clause",4],["Create View",10],

]},
{ course:"RDBMS", week:5, title:"Intermediate SQL - Part 2, Advanced SQL", videos:[
["Use of View in Query",6],["Define a View using other View",2],["View Updates",4],["Transaction",4],
["Integrity Constraints",9],["Cascading Action in Referential Integrity",7],["Index Creation",5],
["Authorization",9],["Roles and Summary of this lecture",6],["Accessing SQL from a programming language",12],
["JDBC - Create connection, Execute SQL statement",8],["JDBC - Prepared SQL statement, Transactions",10],
["ODBC, Dynamic SQL in C",5],["Embedded SQL in C",8],["Cursors",11],["SQL Functions",10],
["SQL Procedures, Language constructs, Summary of learning",9],

]},
{ course:"RDBMS", week:6, title:"Database Design using ER Model", videos:[
["Recap & Need of Database Design",6],["Database Design Phases",6],["ER Model, Entity Sets and Representation",8],
["Relationship Sets & Representation",4],["Role, Descriptive Attributes",5],["Degree of Relationship Sets, Attribute Types",7],
["Cardinality Ratio/Constraints",7],["Notations of Complex Cardinality Constraints",5],
["Total & Partial Participation, Primary Key, Redundant Attribute",8],["Weak Entity Sets & Representation",6],
["Example: ER Diagram of University Enterprise",6],["ER Model Design Issue - 1 & 2",7],["ER Model Design Issue - 3",7],
["Entity Sets Vs Attributes & Vs Relationship Sets",7],["Mapping Entity Sets into Relational Schema",6],
["Mapping Relationship Sets & Composite Attributes",5],["Redundancy of Schemas, Summary",5],

]},
{ course:"RDBMS", week:7, title:"Relational Database Design - FD Part 1", videos:[
["Recap & Database Design Intro",10],["Features of Good Relational Design",5],["Meaning of Lossy decomposition",6],
["Meaning of Lossless Decomposition",6],["Normalization Theory",7],["Functional Dependencies Definition",7],
["Keys & Functional Dependencies",4],["Use of Functional Dependencies",8],["Trivial Functional Dependencies",2],
["Closure of a Set of FDs",13],["Lossless Decomposition using FDs",12],["Dependency Preservation",6],

]},
{ course:"RDBMS", week:8, title:"FDs Part 2, Normal Forms Part 1", videos:[
["Closure of Attribute Sets",5],["Uses of Attribute Closure",5],["Testing for Superkey",7],
["Canonical Cover of Extraneous Attributes",13],["Canonical Cover Formation",7],["Summary of Learning on FDs",6],
["Multivalued Dependencies (MVDs)",6],["Decomposition for MVDs & Conclusion",5],
["Recap & Normalization Theory & Normal Forms",10],["Lossless Decomposition & Dependency Preservation",10],["First Normal Form",10],

]},
{ course:"RDBMS", week:9, title:"NF Part 2 (2NF, 3NF, BCNF, 4NF)", videos:[
["Second Normal Form",12],["Third Normal Form (3NF)",12],["More Examples on 3NF",6],["Boyce-Codd Normal Form (BCNF)",15],
["Decomposition Example (1NF-BCNF)",7],["Decompose to 1NF",6],["Decompose to 2NF",7],["Decompose to 3NF",5],
["Decompose to BCNF",5],["MVD Theory & Fourth Normal Form (4NF) & Summary",16],

]},
{ course:"RDBMS", week:10, title:"Transactions", videos:[
["Recap, Concept of Transactions",8],["Atomicity, Durability, Consistency Requirements",10],
["Isolation Requirement, ACID Properties",9],["Transaction States, Concurrent Execution",8],
["Concept of Schedule, Serial Schedule",8],["Equivalent Schedule, Concurrent Schedule",7],
["Concept of Serializability, Conflicting Instruction",9],["Conflict Serializability",8],["View Serializability",11],
["Testing for Serializability",9],["Recoverable Schedule",6],["Cascading Rollbacks & Summary",8],

]},
{ course:"RDBMS", week:11, title:"Concurrency Control", videos:[
["Recap & Introduction to Concurrency Control",9],["Lock-Based Protocol Design",9],["Schedule with Lock-Based Approach",8],
["Issues in Schedules with Lock-Based Approach",6],["Two-phase Locking Protocol (2PL)",7],["Limitations of 2PL and Extensions",6],
["Lock Conversions & Summary of 2PL",7],["Lock Implementation Approach",3],["Deadlock Prevention: No Cyclic Wait",10],
["Deadlock Prevention: Wait-Die",8],["Deadlock Prevention: Wound-Wait",5],["Deadlock Detection & Recovery",10],
["Timestamp-Based Protocol: TSO",11],["Schedule Using TSO Protocol",14],["Thomas Write Rule and Summary",8],

]},
{ course:"RDBMS", week:12, title:"File Organization and Indexing", videos:[
["Recap, File Organization, Representation of Records",14],["Fixed length Records - Addition & Deletion",8],
["Organization of Records in File, Sequential File Organization",12],["Indexing, Type of Indices",11],
["Ordered Indices, Dense & Sparse Index Files",8],["Sparse Vs Dense, Primary Vs Secondary Indices",9],
["Ordered Index Update - Deletion, Insertion",9],["B+ Tree Index Files",4],["Structure of B+ tree",12],
["Leaf and Non-Leaf Nodes in B+ Tree",7],["Queries on B+ Trees",8],["Insertion into B+Tree - 1st",8],
["Insertion into B+Tree - 2nd",9],["Deletion from B+ Tree",5],["B+ tree File Organization, Summary",3],

]},
{ course:"Java", week:1, title:"Overview of JAVA Programming Language", videos:[
["Course Introduction",3],["Why study JAVA",10],["History of JAVA",9],["Features of JAVA Programming",10],
["Basics of Object-Oriented Programming",9],["Three principles of Object-Oriented Programming",20],
]},
{ course:"Java", week:2, title:"Writing JAVA programs", videos:[["How to write a JAVA program",39]]},
{ course:"Java", week:3, title:"Data types and keywords", videos:[["Understanding the data types and keywords",44]]},
{ course:"Java", week:4, title:"Typecasting, Arrays", videos:[
["Typecasting, Truncation and Type promotion",30],["Arrays",19]]},
{ course:"Java", week:5, title:"Operators", videos:[
["Arithmetic Operators",8],["Assignment Operator and its Shorthand",4],["Increment and Decrement Operators",5],
["Bit-wise Operators",12],["Bit-wise Operators Continued",7],["Relational, Boolean Logical, Ternary Operators",16]]},
{ course:"Java", week:6, title:"Control statements", videos:[
["Control statements: if-else-if",15],["Control statements: Switch statement",11],["Control statements: Nested-switch",3],
["Iterative control statement: while loop",4],["Iterative control statement: do-while",7]]},
{ course:"Java", week:7, title:"Classes and objects", videos:[
["Introduction to class and object",34],["Properties of an object",11],["Understanding class and object - detailed example",7],
["Constructors",4],["Parameterized Constructors",6]]},
{ course:"Java", week:8, title:"This, overloading, access control", videos:[
["\"This\" keyword, Destructor",12],["Function overloading",9],["Class member access control",12],
["Creating Stack using private variables",8],]},
{ course:"Java", week:9, title:"Inheritance", videos:[
["How to implement inheritance",16],["Use of private variables in Superclass",12],
["Superclass variable referring to subclass object",13],["Use of super keyword",23],["Method overriding",17]]},
{ course:"Java", week:10, title:"Polymorphism, abstraction, interfaces", videos:[
["Polymorphism in Inheritance",19],["Abstract Classes and methods",13],["Final method in superclass",6],["Interfaces",32]]},
{ course:"Java", week:11, title:"Exception handling", videos:[
["Try Catch block example",7],["Multiple catch statement example",7],["Throw statement",10],["Throws and Finally statements",21]]},
{ course:"Java", week:12, title:"Multithreading", videos:[
["Introduction to multi-threaded programming",33],["Implementation of multi-threading in detail",34],
["Implementing runnable",14],["Creating multiple threads",18],]},
{ course:"Optimization", week:1, title:"Fundamentals of Optimization", videos:[
["Meet your instructor & Course Introduction",14],["Modeling optimization problems",1],
["Formulation of optimization problem part-1",16],["Formulation of optimization problem part-2",10],
["Mathematical Foundations Part-1",23],["Mathematical Foundations Part-2",18],
]},
{ course:"Optimization", week:2, title:"First and Second Order Necessary Conditions", videos:[
["First Order Necessary Condition (FONC)",21],["Second Order Necessary Condition (SONC)",18],
]},
{ course:"Optimization", week:3, title:"Unconstrained Optimization", videos:[
["Convex Sets and Convex Functions",19],["Unconstrained Optimization",25],]},
{ course:"Optimization", week:4, title:"1D search + Gradient method", videos:[
["Golden section search method",20],["Fibonacci search method",11],["Newton's method and Secant method",11],
["Gradient descent algorithm & Method of steepest descent",21],]},
{ course:"Optimization", week:5, title:"Convergence of gradient descent", videos:[
["Convergence of gradient descent algorithm",22],["Rate of convergence of gradient descent",13],
]},
{ course:"Optimization", week:6, title:"Newton's Method", videos:[
["Newton's method",22],["Newton's method (continued)",21],]},
{ course:"Optimization", week:7, title:"Quasi-Newton's method", videos:[
["Quasi-Newton's method",20],["Quasi-Newton's method (continued)",10],["Rank One Correction method",13],
["Rank One Correction method (continued)",13],["📝 Practice Assignment",30]]},
{ course:"Optimization", week:8, title:"Linear Optimization", videos:[
["Standard Form of Linear Programs",19],["Example Problems",16],["Properties of Basic Solutions",11],
["📝 Practice Assignment",30]]},
{ course:"Optimization", week:9, title:"Simplex Method", videos:[
["Simplex Method",25],["The Canonical Augmented Matrix",14],["Updating The Augmented Matrix",11],
["📝 Practice Assignment",30]]},
{ course:"Optimization", week:10, title:"Simplex Algorithm + Duality", videos:[
["Simplex Algorithm",40],["Matrix Form of the Simplex Method",19],["Duality",7],
["Solution by Matrix form of Simplex method",8],["Example Problem",7],
["📝 Practice Assignment",30]]},
{ course:"Optimization", week:11, title:"Duality & Constrained Optimization", videos:[
["Duality (continued)",9],["Constraint Optimization",28],["Examples",12],["Karush-Kuhn-Tucker (KKT) Condition",10],
["Examples",8],["📝 Practice Assignment",30]]},
{ course:"Optimization", week:12, title:"Projected Gradient + Convex Optimization", videos:[
["Lagrange Multipliers Example",12],["Projected Gradient Method",17],["Convex Optimization",13],
["Examples",14],["Examples (Continued)",5],["📝 Practice Assignment",30]]},
];
/* Trimester test series. PTs on Mondays of even weeks, NPTs on Sundays of odd
   weeks (from the official schedule; Java/Opt weekdays assumed same cadence —
   correct me with actual days and I'll shift them). */
const SEED_TESTS = [
{ sys:"iitg", course:"RDBMS", type:"proctored", date:"2026-09-15", time:"08:00" },
{ sys:"iitg", course:"RDBMS", type:"nonproctored", date:"2026-09-27", time:"23:55" },
{ sys:"iitg", course:"RDBMS", type:"proctored", date:"2026-09-29", time:"09:00" },
{ sys:"iitg", course:"RDBMS", type:"nonproctored", date:"2026-10-11", time:"23:55" },
{ sys:"iitg", course:"RDBMS", type:"proctored", date:"2026-10-13", time:"09:00" },
{ sys:"iitg", course:"RDBMS", type:"nonproctored", date:"2026-10-25", time:"23:55" },
{ sys:"iitg", course:"RDBMS", type:"proctored", date:"2026-10-27", time:"09:00" },
{ sys:"iitg", course:"RDBMS", type:"nonproctored", date:"2026-11-08", time:"23:55" },
{ sys:"iitg", course:"RDBMS", type:"proctored", date:"2026-11-10", time:"09:00" },
{ sys:"iitg", course:"RDBMS", type:"nonproctored", date:"2026-11-22", time:"23:55" },
{ sys:"iitg", course:"RDBMS", type:"proctored", date:"2026-11-24", time:"09:00" },
{ sys:"iitg", course:"Java", type:"nonproctored", date:"2026-09-27", time:"23:55" },
{ sys:"iitg", course:"Java", type:"proctored", date:"2026-09-28", time:"08:30" },
{ sys:"iitg", course:"Java", type:"nonproctored", date:"2026-10-11", time:"23:55" },
{ sys:"iitg", course:"Java", type:"proctored", date:"2026-10-12", time:"08:30" },
{ sys:"iitg", course:"Java", type:"nonproctored", date:"2026-10-25", time:"23:55" },
{ sys:"iitg", course:"Java", type:"proctored", date:"2026-10-26", time:"19:42" },
{ sys:"iitg", course:"Java", type:"nonproctored", date:"2026-11-08", time:"23:55" },
{ sys:"iitg", course:"Java", type:"proctored", date:"2026-11-09", time:"19:42" },
{ sys:"iitg", course:"Java", type:"nonproctored", date:"2026-11-22", time:"23:55" },
{ sys:"iitg", course:"Java", type:"proctored", date:"2026-11-23", time:"19:42" },
{ sys:"iitg", course:"Java", type:"nonproctored", date:"2026-11-29", time:"23:55" },
{ sys:"iitg", course:"Optimization", type:"nonproctored", date:"2026-09-27", time:"23:55" },
{ sys:"iitg", course:"Optimization", type:"proctored", date:"2026-09-28", time:"08:30" },
{ sys:"iitg", course:"Optimization", type:"nonproctored", date:"2026-10-11", time:"23:55" },
{ sys:"iitg", course:"Optimization", type:"proctored", date:"2026-10-12", time:"08:30" },
{ sys:"iitg", course:"Optimization", type:"nonproctored", date:"2026-10-25", time:"23:55" },
{ sys:"iitg", course:"Optimization", type:"proctored", date:"2026-10-26", time:"20:52" },
{ sys:"iitg", course:"Optimization", type:"nonproctored", date:"2026-11-08", time:"23:55" },
{ sys:"iitg", course:"Optimization", type:"proctored", date:"2026-11-09", time:"20:52" },
{ sys:"iitg", course:"Optimization", type:"nonproctored", date:"2026-11-22", time:"23:55" },
{ sys:"iitg", course:"Optimization", type:"proctored", date:"2026-11-23", time:"20:52" },
{ sys:"iitg", course:"Optimization", type:"nonproctored", date:"2026-11-29", time:"23:55" },
];
