-- MySQL / MariaDB version of the same schema (for XAMPP, cPanel or a hosted MySQL server).
-- The bundled server uses SQLite; to switch, replace the better-sqlite3 calls in server.js
-- with a MySQL driver such as mysql2.
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  business_name VARCHAR(200) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(190) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(12) NOT NULL,
  reg_number VARCHAR(60) NOT NULL DEFAULT '',
  scheme VARCHAR(100) NOT NULL,
  products TEXT NOT NULL,
  status ENUM('pending','under_review','approved','rejected') NOT NULL DEFAULT 'pending',
  remarks TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_app_status (status)
);
CREATE TABLE certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sr_no INT NOT NULL UNIQUE,
  cert_no VARCHAR(30) NOT NULL UNIQUE,
  application_id INT NOT NULL UNIQUE,
  issue_date DATETIME NOT NULL,
  expiry_date DATETIME NOT NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);
CREATE TABLE fees (
  `key` VARCHAR(50) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL
);
INSERT INTO fees (`key`,label,amount) VALUES
 ('registration_fee','Registration fee per year',10000),
 ('per_product_fee','Fee per product',500),
 ('audit_fee_per_day','Audit fee per auditor per day',1000),
 ('logo_fee','Halal logo licence per year (optional)',20000),
 ('gst_percent','GST percent',18);
