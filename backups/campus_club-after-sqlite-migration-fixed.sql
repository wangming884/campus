-- MySQL dump 10.13  Distrib 9.6.0, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: campus_club
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_categories`
--

DROP TABLE IF EXISTS `activity_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_categories`
--

LOCK TABLES `activity_categories` WRITE;
/*!40000 ALTER TABLE `activity_categories` DISABLE KEYS */;
INSERT INTO `activity_categories` VALUES (6,'技术沙龙 (工作坊/讲座/实战)',1,1,'2026-09-14 05:19:30'),(7,'创客黑客松 (马拉松比赛/Demo秀)',2,1,'2026-09-14 05:19:30'),(8,'破冰团建 (交流会/联谊/户外桌游)',3,1,'2026-09-14 05:19:30'),(9,'名企参访 (行业实地观摩)',4,1,'2026-09-14 05:19:30'),(10,'竞赛培训 (挑战杯/互联网+/算法)',5,1,'2026-09-14 05:19:30');
/*!40000 ALTER TABLE `activity_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_proposals`
--

DROP TABLE IF EXISTS `activity_proposals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `creator_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creator_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creator_college` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '技术沙龙',
  `expected_time` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expected_location` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `budget` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `details` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'voting',
  `vote_count` int DEFAULT '0',
  `admin_decision_notes` text COLLATE utf8mb4_unicode_ci,
  `decided_by` int DEFAULT NULL,
  `decided_admin_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_proposals`
--

LOCK TABLES `activity_proposals` WRITE;
/*!40000 ALTER TABLE `activity_proposals` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_proposals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `application_templates`
--

DROP TABLE IF EXISTS `application_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `application_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filepath` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` bigint DEFAULT '0',
  `is_active` tinyint DEFAULT '1',
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `application_templates`
--

LOCK TABLES `application_templates` WRITE;
/*!40000 ALTER TABLE `application_templates` DISABLE KEYS */;
INSERT INTO `application_templates` VALUES (2,'申请表','发明创新协会2026-2027学年干事留任申请表.docx','E:\\campus\\uploads\\templates\\发明创新协会2026-2027学年干事留任申请表_1789309792716_1165.docx',18139,1,1,'2026-09-13 06:29:52');
/*!40000 ALTER TABLE `application_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `club_documents`
--

DROP TABLE IF EXISTS `club_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `club_documents` (
  `id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filepath` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` bigint DEFAULT '0',
  `uploaded_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `club_documents`
--

LOCK TABLES `club_documents` WRITE;
/*!40000 ALTER TABLE `club_documents` DISABLE KEYS */;
INSERT INTO `club_documents` VALUES (1,'2026ææ°æå.pdf','2026ææ°æå.pdf','E:\\campus\\uploads\\club\\club-introduction_1789314335845.pdf','application/pdf',1930421,1,'2026-09-13 07:45:35');
/*!40000 ALTER TABLE `club_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `development_directions`
--

DROP TABLE IF EXISTS `development_directions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `development_directions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `development_directions`
--

LOCK TABLES `development_directions` WRITE;
/*!40000 ALTER TABLE `development_directions` DISABLE KEYS */;
INSERT INTO `development_directions` VALUES (11,'社团成员',1,1,'2026-09-13 08:00:42'),(12,'大二留任（管理员）',2,1,'2026-09-13 08:01:02');
/*!40000 ALTER TABLE `development_directions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_verification_codes`
--

DROP TABLE IF EXISTS `email_verification_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verification_codes` (
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `sent_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_verification_codes`
--

LOCK TABLES `email_verification_codes` WRITE;
/*!40000 ALTER TABLE `email_verification_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_verification_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mail_logs`
--

DROP TABLE IF EXISTS `mail_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mail_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `to_email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'sent',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mail_logs`
--

LOCK TABLES `mail_logs` WRITE;
/*!40000 ALTER TABLE `mail_logs` DISABLE KEYS */;
INSERT INTO `mail_logs` VALUES (3,'123456@qq.com','张腾飞','🎉【录取通知书】张腾飞 同学，欢迎加入大学发明创新协会！','\n    <div style=\"font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);\">\n\n      <div style=\"background: linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%); padding: 40px 32px; color: #ffffff; text-align: center; position: relative;\">\n        <div style=\"position: absolute; top: 12px; left: 24px; font-size: 12px; opacity: 0.7; letter-spacing: 2px;\">OFFICIAL ADMISSION LETTER</div>\n        <div style=\"font-size: 48px; margin-bottom: 8px;\">🎓</div>\n        <h1 style=\"margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;\">录 取 通 知 书</h1>\n        <p style=\"margin: 10px 0 0 0; opacity: 0.92; font-size: 15px; font-weight: 500;\">\n          University Youth Geek & Innovation Club · Offer Letter\n        </p>\n      </div>\n\n      <div style=\"padding: 32px 28px; color: #334155; line-height: 1.85; font-size: 15px;\">\n\n        <p style=\"font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 6px;\">\n          👋 亲爱的 <span style=\"color: #7c3aed;\">张腾飞</span> 同学：\n        </p>\n        <p style=\"color: #475569; margin-bottom: 4px;\">\n          🏫 <strong>冶金工程学院</strong> · <strong>型242</strong>\n        </p>\n\n        <p style=\"margin-top: 18px;\">\n          非常荣幸地通知您，经我社<strong>管理团队与考核委员会</strong>严格、认真审核您提交的《入社申请表》与个人履历材料，您的技术水平、学习热情与团队潜质获得一致高度认可，现决定<strong style=\"color: #059669;\">正式录取您为社团官方成员</strong>！\n        </p>\n\n        <div style=\"background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px solid #86efac; border-radius: 12px; padding: 20px 24px; margin: 22px 0;\">\n          <h3 style=\"margin: 0 0 14px 0; font-size: 16px; color: #065f46;\">📋 录用信息确认 · Membership Confirmation</h3>\n          <table style=\"width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;\">\n            <tr>\n              <td style=\"padding: 6px 0; width: 130px; font-weight: 600; color: #1e293b;\">社员编号</td>\n              <td style=\"padding: 6px 0;\"><code style=\"background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 13px;\">GEEK-MTZX4GRB-4GC7</code></td>\n            </tr>\n            <tr>\n              <td style=\"padding: 6px 0; font-weight: 600; color: #1e293b;\">系统角色</td>\n              <td style=\"padding: 6px 0;\"><span style=\"background: #fbbf24; color: #78350f; padding: 2px 10px; border-radius: 20px; font-size: 13px; font-weight: 700;\">🌟 正式社团成员</span></td>\n            </tr>\n            <tr>\n              <td style=\"padding: 6px 0; font-weight: 600; color: #1e293b;\">录用部门/方向</td>\n              <td style=\"padding: 6px 0; font-weight: 500; color: #7c3aed;\">前沿全栈与AI研发方向</td>\n            </tr>\n            \n            <tr>\n              <td style=\"padding: 6px 0; font-weight: 600; color: #1e293b;\">审核组评语</td>\n              <td style=\"padding: 6px 0; font-style: italic; color: #065f46;\">\"欢迎加入社团，期待你的精彩表现！\"</td>\n            </tr>\n          </table>\n        </div>\n\n        <div style=\"background: #fefce8; border: 1.5px solid #fde047; border-radius: 12px; padding: 20px 24px; margin: 22px 0;\">\n          <h3 style=\"margin: 0 0 10px 0; font-size: 16px; color: #854d0e;\">🎁 入社即享 · Member Exclusive Benefits</h3>\n          <ul style=\"margin: 0; padding-left: 20px; color: #713f12; line-height: 2;\">\n            <li><strong>👤 社员身份凭证：</strong>个人中心解锁官方数字认证徽章与凭据编号</li>\n            <li><strong>🔒 社内专享通知：</strong>可查阅仅社员可见的内部规章制度与备忘</li>\n            <li><strong>🗳️ 活动共创与投票：</strong>发起技术沙龙/创客松提案，参与全员民主表决</li>\n            <li><strong>💬 成员交流留言：</strong>在社内交流区畅聊技术，获得管理官方回复</li>\n            <li><strong>⚡ 302创客工坊：</strong>全天候自由使用极客工位与私有GPU算力集群（需预约）</li>\n          </ul>\n        </div>\n\n        <div style=\"background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 12px; padding: 20px 24px; margin: 22px 0;\">\n          <h3 style=\"margin: 0 0 10px 0; font-size: 16px; color: #1e40af;\">📌 下一步行动指南 · Onboarding Checklist</h3>\n          <ol style=\"margin: 0; padding-left: 20px; color: #1e3a5f; line-height: 2;\">\n            <li><strong>登录个人中心：</strong>使用当前账号登录 <a href=\"/profile\" style=\"color: #2563eb;\">官网个人工作台</a>，查看新身份凭证</li>\n            <li><strong>加入官方联络群：</strong>QQ大群 <strong style=\"background: #dbeafe; padding: 2px 8px; border-radius: 4px;\">889217643</strong>（入群备注：姓名+部门方向）</li>\n            <li><strong>关注迎新活动：</strong>留意近期社团全员迎新大会与部门见面破冰沙龙通知</li>\n            <li><strong>完善个人资料：</strong>在个人设置中补充技术栈、GitHub 地址等个人标签</li>\n          </ol>\n        </div>\n\n        <p style=\"font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 28px; text-align: center;\">\n          🚀 期待在未来的日子里与你并肩探索<br/>\n          共同打造校园最强技术极客社区！\n        </p>\n\n        <div style=\"margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.8;\">\n          <div style=\"font-weight: 700; color: #64748b; font-size: 14px;\">大学发明创新协会 · 理事会 & 招新工作组</div>\n          <div>📧 官方邮箱：campus@geek.club &nbsp;|&nbsp; 🌐 官网：登录个人中心查看</div>\n          <div style=\"margin-top: 8px;\">本邮件由系统在审核通过后自动发送，请勿直接回复</div>\n          <div style=\"font-size: 11px; color: #cbd5e1;\">Generated by Campus Club Management System v2.0</div>\n        </div>\n      </div>\n    </div>\n  ','simulated',NULL,'2026-09-13 06:37:29');
/*!40000 ALTER TABLE `mail_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_messages`
--

DROP TABLE IF EXISTS `member_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `user_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_college` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_pinned` tinyint DEFAULT '0',
  `admin_reply` text COLLATE utf8mb4_unicode_ci,
  `reply_admin_id` int DEFAULT NULL,
  `reply_admin_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replied_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_messages`
--

LOCK TABLES `member_messages` WRITE;
/*!40000 ALTER TABLE `member_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `membership_applications`
--

DROP TABLE IF EXISTS `membership_applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `membership_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `college` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `className` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qq` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_dept` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statement` text COLLATE utf8mb4_unicode_ci,
  `submission_filename` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submission_filepath` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `reviewer_id` int DEFAULT NULL,
  `reviewer_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `membership_applications`
--

LOCK TABLES `membership_applications` WRITE;
/*!40000 ALTER TABLE `membership_applications` DISABLE KEYS */;
INSERT INTO `membership_applications` VALUES (2,5,'张腾飞','冶金工程学院','型242','123456','123456@qq.com','前沿全栈与AI研发方向','',NULL,NULL,'approved',1,'王志豪','欢迎加入社团，期待你的精彩表现！','2026-09-13 14:37:29','2026-09-13 06:36:35'),(3,5,'张腾飞','冶金工程学院','型242','123456','123456@qq.com','创意策划与大型活动方向','','发明创新协会2026-2027学年干事留任申请表.docx','E:\\campus\\uploads\\submissions\\入社申请_张腾飞_1789310907330_5833.docx','pending',NULL,NULL,NULL,NULL,'2026-09-13 06:48:27');
/*!40000 ALTER TABLE `membership_applications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notices`
--

DROP TABLE IF EXISTS `notices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '通知',
  `author_id` int DEFAULT NULL,
  `author_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `views` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notices`
--

LOCK TABLES `notices` WRITE;
/*!40000 ALTER TABLE `notices` DISABLE KEYS */;
/*!40000 ALTER TABLE `notices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `portal_config`
--

DROP TABLE IF EXISTS `portal_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portal_config` (
  `id` int NOT NULL,
  `club_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hero_badge` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_title` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `hero_subtitle` text COLLATE utf8mb4_unicode_ci,
  `about_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `about_content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `stats_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `departments_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `portal_config`
--

LOCK TABLES `portal_config` WRITE;
/*!40000 ALTER TABLE `portal_config` DISABLE KEYS */;
INSERT INTO `portal_config` VALUES (1,'发明创新协会','🚀 2026 火热纳新中','启迪创新思维，锻炼实践能力','','关于发明创新协会','安徽工业大学发明创新协会安徽工业大学发明创新协会创立于 2012 年。在此十年内我们秉承着 “团结、求实、勤奋、创新” 的校风坚持 “树立时代精神，启迪创新思维，探讨学术科研，锻炼实践能力，展现个人风采，丰富校园生活” 的宗旨。本协会致力于开拓创新思维，激励会员相互之间相互探讨学术问题，形成良好的学术氛围。在日常生活中定期交流设想，不断提高会员的创新能力，为撰写专利打下良好基础。\n\n本协会自成立至今，组织会员赴律师事务所社会实践近 50 次，授权专利近 500 项；组织创新培训、双创赛事 500 余次；获得国家级、省级以及校级奖项 1000 余项；2019 - 2020 年度被评为 “优秀社团部” 荣誉称号，2020 年被评为 “全国最具影响力的双创社团”，在 2022 - 2023 学年第二学期安徽工业大学社团联合会业务技能评比大赛中获得一等奖，连续 9 年获得 “校十佳社团” 荣誉称号。','[{\"label\":\"入社考核通过率\",\"value\":\"88\",\"unit\":\"%\",\"icon\":\"users\"},{\"label\":\"新指标\",\"value\":\"100\",\"unit\":\"+\",\"icon\":\"calendar\"},{\"label\":\"新指标\",\"value\":\"100\",\"unit\":\"+\",\"icon\":\"award\"},{\"label\":\"新指标\",\"value\":\"100\",\"unit\":\"+\",\"icon\":\"layers\"}]','[{\"id\":\"tech\",\"name\":\"技术研发部\",\"badge\":\"核心主力\",\"intro\":\"专注于开源项目开发\",\"skills\":\"JavaScript / Python\",\"icon\":\"code\"}]','{\"email\":\"club@campus.edu\",\"qqGroup\":\"\",\"wechat\":\"\",\"location\":\"\"}','2026-09-10 08:30:22');
/*!40000 ALTER TABLE `portal_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proposal_votes`
--

DROP TABLE IF EXISTS `proposal_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proposal_votes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `proposal_id` int NOT NULL,
  `user_id` int NOT NULL,
  `user_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_proposal_user` (`proposal_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proposal_votes`
--

LOCK TABLES `proposal_votes` WRITE;
/*!40000 ALTER TABLE `proposal_votes` DISABLE KEYS */;
/*!40000 ALTER TABLE `proposal_votes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_applications`
--

DROP TABLE IF EXISTS `role_applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `user_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `target_direction` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `reviewer_id` int DEFAULT NULL,
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_applications`
--

LOCK TABLES `role_applications` WRITE;
/*!40000 ALTER TABLE `role_applications` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_applications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `site_pages`
--

DROP TABLE IF EXISTS `site_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_pages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_system` tinyint DEFAULT '0',
  `is_nav_visible` tinyint DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `seo_description` text COLLATE utf8mb4_unicode_ci,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `content_html` longtext COLLATE utf8mb4_unicode_ci,
  `template_config` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `site_pages`
--

LOCK TABLES `site_pages` WRITE;
/*!40000 ALTER TABLE `site_pages` DISABLE KEYS */;
INSERT INTO `site_pages` VALUES (1,'首页','home','/',1,1,1,'高校社团官方主页','高校社团官方主页','','{\"badge\":\"\",\"bannerTitle\":\"\",\"bannerDescription\":\"\",\"introTitle\":\"\",\"introContent\":\"\",\"showHighlights\":false,\"showPillars\":false,\"showRecruitmentSteps\":true,\"showNotices\":true,\"aboutSectionTitle\":\"\",\"aboutSectionDescription\":\"\",\"highlight1Title\":\"\",\"highlight1Text\":\"\",\"highlight2Title\":\"\",\"highlight2Text\":\"\",\"highlight3Title\":\"\",\"highlight3Text\":\"\",\"pillarSectionTitle\":\"\",\"pillarSectionDescription\":\"\",\"pillar1Title\":\"\",\"pillar1Text\":\"\",\"pillar2Title\":\"\",\"pillar2Text\":\"\",\"pillar3Title\":\"\",\"pillar3Text\":\"\",\"pillar4Title\":\"\",\"pillar4Text\":\"\",\"recruitmentSectionTitle\":\"\",\"recruitmentSectionDescription\":\"\",\"noticeSectionTitle\":\"\",\"noticeSectionDescription\":\"\"}','2026-09-13 07:43:19','2026-09-13 07:43:19'),(2,'关于我们','about','/about',1,1,2,'社团发展历程、文化理念与荣誉介绍','社团发展历程、文化理念与荣誉介绍','',NULL,'2026-09-13 07:43:19','2026-09-13 07:43:19'),(3,'纳新通道','recruitment','/recruitment',1,1,3,'社团招新申请与报名通道','社团招新申请与报名通道','','{\"badge\":\"\",\"bannerTitle\":\"\",\"bannerDescription\":\"\",\"introTitle\":\"\",\"introContent\":\"\",\"showDownload\":true,\"showApplication\":true,\"showFaq\":false,\"downloadStepLabel\":\"\",\"applicationTitle\":\"\",\"applicationDescription\":\"\",\"faqTitle\":\"\",\"faq1Question\":\"\",\"faq1Answer\":\"\",\"faq2Question\":\"\",\"faq2Answer\":\"\",\"faq3Question\":\"\",\"faq3Answer\":\"\",\"faq4Question\":\"\",\"faq4Answer\":\"\"}','2026-09-13 07:43:19','2026-09-13 07:43:19'),(4,'通知公告','notices','/notices',1,1,4,'社团公开通知和成员公告','社团公开通知和成员公告','',NULL,'2026-09-13 07:43:19','2026-09-13 07:43:19'),(5,'联系方式','contact','/contact',1,1,5,'社团联系方式与在线咨询','社团联系方式与在线咨询','',NULL,'2026-09-13 07:43:20','2026-09-13 07:43:20');
/*!40000 ALTER TABLE `site_pages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES ('mock_mode','true','2026-09-13 06:45:10'),('registration_limit','1000','2026-09-16 06:11:12'),('smtp_host','smtp.qq.com','2026-09-13 06:45:10'),('smtp_pass','','2026-09-10 08:20:34'),('smtp_port','465','2026-09-13 06:45:10'),('smtp_secure','true','2026-09-13 06:45:10'),('smtp_sender_name','发明创新协会','2026-09-13 06:45:10'),('smtp_user','youth_geek_club@qq.com','2026-09-13 06:45:10');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `college` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `className` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qq` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'王志豪','superadmin@campus.club','$2b$10$NuJz5298YRC05TiwGm0tee.As1/ku1mm2vLglhLWFzKAaHS9K6SPK','冶金工程学院','型245','100000001','super_admin','2026-09-10 08:20:34'),(5,'张腾飞','123456@qq.com','$2b$10$Ev8QNNikMtnx/DW93jhx1utDYGhc6HxmAUE2gLNrm/PHrt81XKuJu','冶金工程学院','型242','123456','admin','2026-09-13 06:33:16');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'campus_club'
--

--
-- Dumping routines for database 'campus_club'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-16 23:44:54
