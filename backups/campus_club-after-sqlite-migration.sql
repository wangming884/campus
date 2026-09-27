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
INSERT INTO `activity_categories` VALUES (6,'鎶€鏈矙榫?(宸ヤ綔鍧?璁插骇/瀹炴垬)',1,1,'2026-09-14 05:19:30'),(7,'鍒涘榛戝鏉?(椹媺鏉炬瘮璧?Demo绉€)',2,1,'2026-09-14 05:19:30'),(8,'鐮村啺鍥㈠缓 (浜ゆ祦浼?鑱旇皧/鎴峰妗屾父)',3,1,'2026-09-14 05:19:30'),(9,'鍚嶄紒鍙傝 (琛屼笟瀹炲湴瑙傛懇)',4,1,'2026-09-14 05:19:30'),(10,'绔炶禌鍩硅 (鎸戞垬鏉?浜掕仈缃?/绠楁硶)',5,1,'2026-09-14 05:19:30');
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
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '鎶€鏈矙榫?,
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
INSERT INTO `application_templates` VALUES (2,'鐢宠琛?,'鍙戞槑鍒涙柊鍗忎細2026-2027瀛﹀勾骞蹭簨鐣欎换鐢宠琛?docx','E:\\campus\\uploads\\templates\\鍙戞槑鍒涙柊鍗忎細2026-2027瀛﹀勾骞蹭簨鐣欎换鐢宠琛╛1789309792716_1165.docx',18139,1,1,'2026-09-13 06:29:52');
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
INSERT INTO `club_documents` VALUES (1,'2026忙聥聸忙聳掳忙聣聥氓聠聦.pdf','2026忙聥聸忙聳掳忙聣聥氓聠聦.pdf','E:\\campus\\uploads\\club\\club-introduction_1789314335845.pdf','application/pdf',1930421,1,'2026-09-13 07:45:35');
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
INSERT INTO `development_directions` VALUES (11,'绀惧洟鎴愬憳',1,1,'2026-09-13 08:00:42'),(12,'澶т簩鐣欎换锛堢鐞嗗憳锛?,2,1,'2026-09-13 08:01:02');
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
INSERT INTO `mail_logs` VALUES (3,'123456@qq.com','寮犺吘椋?,'馃帀銆愬綍鍙栭€氱煡涔︺€戝紶鑵鹃 鍚屽锛屾杩庡姞鍏ュぇ瀛﹀彂鏄庡垱鏂板崗浼氾紒','\n    <div style=\"font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);\">\n\n      <div style=\"background: linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%); padding: 40px 32px; color: #ffffff; text-align: center; position: relative;\">\n        <div style=\"position: absolute; top: 12px; left: 24px; font-size: 12px; opacity: 0.7; letter-spacing: 2px;\">OFFICIAL ADMISSION LETTER</div>\n        <div style=\"font-size: 48px; margin-bottom: 8px;\">馃帗</div>\n        <h1 style=\"margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;\">褰?鍙?閫?鐭?涔?/h1>\n        <p style=\"margin: 10px 0 0 0; opacity: 0.92; font-size: 15px; font-weight: 500;\">\n          University Youth Geek & Innovation Club 路 Offer Letter\n        </p>\n      </div>\n\n      <div style=\"padding: 32px 28px; color: #334155; line-height: 1.85; font-size: 15px;\">\n\n        <p style=\"font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 6px;\">\n          馃憢 浜茬埍鐨?<span style=\"color: #7c3aed;\">寮犺吘椋?/span> 鍚屽锛歕n        </p>\n        <p style=\"color: #475569; margin-bottom: 4px;\">\n          馃彨 <strong>鍐堕噾宸ョ▼瀛﹂櫌</strong> 路 <strong>鍨?42</strong>\n        </p>\n\n        <p style=\"margin-top: 18px;\">\n          闈炲父鑽ｅ垢鍦伴€氱煡鎮紝缁忔垜绀?strong>绠＄悊鍥㈤槦涓庤€冩牳濮斿憳浼?/strong>涓ユ牸銆佽鐪熷鏍告偍鎻愪氦鐨勩€婂叆绀剧敵璇疯〃銆嬩笌涓汉灞ュ巻鏉愭枡锛屾偍鐨勬妧鏈按骞炽€佸涔犵儹鎯呬笌鍥㈤槦娼滆川鑾峰緱涓€鑷撮珮搴﹁鍙紝鐜板喅瀹?strong style=\"color: #059669;\">姝ｅ紡褰曞彇鎮ㄤ负绀惧洟瀹樻柟鎴愬憳</strong>锛乗n        </p>\n\n        <div style=\"background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px solid #86efac; border-radius: 12px; padding: 20px 24px; margin: 22px 0;\">\n          <h3 style=\"margin: 0 0 14px 0; font-size: 16px; color: #065f46;\">馃搵 褰曠敤淇℃伅纭 路 Membership Confirmation</h3>\n          <table style=\"width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;\">\n            <tr>\n              <td style=\"padding: 6px 0; width: 130px; font-weight: 600; color: #1e293b;\">绀惧憳缂栧彿</td>\n              <td style=\"padding: 6px 0;\"><code style=\"background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 13px;\">GEEK-MTZX4GRB-4GC7</code></td>\n            </tr>\n            <tr>\n              <td style=\"padding: 6px 0; font-weight: 600; color: #1e293b;\">绯荤粺瑙掕壊</td>\n              <td style=\"padding: 6px 0;\"><span style=\"background: #fbbf24; color: #78350f; padding: 2px 10px; border-radius: 20px; font-size: 13px; font-weight: 700;\">馃専 姝ｅ紡绀惧洟鎴愬憳</span></td>\n            </tr>\n            <tr>\n              <td style=\"padding: 6px 0; font-weight: 600; color: #1e293b;\">褰曠敤閮ㄩ棬/鏂瑰悜</td>\n              <td style=\"padding: 6px 0; font-weight: 500; color: #7c3aed;\">鍓嶆部鍏ㄦ爤涓嶢I鐮斿彂鏂瑰悜</td>\n            </tr>\n            \n            <tr>\n              <td style=\"padding: 6px 0; font-weight: 600; color: #1e293b;\">瀹℃牳缁勮瘎璇?/td>\n              <td style=\"padding: 6px 0; font-style: italic; color: #065f46;\">\"娆㈣繋鍔犲叆绀惧洟锛屾湡寰呬綘鐨勭簿褰╄〃鐜帮紒\"</td>\n            </tr>\n          </table>\n        </div>\n\n        <div style=\"background: #fefce8; border: 1.5px solid #fde047; border-radius: 12px; padding: 20px 24px; margin: 22px 0;\">\n          <h3 style=\"margin: 0 0 10px 0; font-size: 16px; color: #854d0e;\">馃巵 鍏ョぞ鍗充韩 路 Member Exclusive Benefits</h3>\n          <ul style=\"margin: 0; padding-left: 20px; color: #713f12; line-height: 2;\">\n            <li><strong>馃懁 绀惧憳韬唤鍑瘉锛?/strong>涓汉涓績瑙ｉ攣瀹樻柟鏁板瓧璁よ瘉寰界珷涓庡嚟鎹紪鍙?/li>\n            <li><strong>馃敀 绀惧唴涓撲韩閫氱煡锛?/strong>鍙煡闃呬粎绀惧憳鍙鐨勫唴閮ㄨ绔犲埗搴︿笌澶囧繕</li>\n            <li><strong>馃棾锔?娲诲姩鍏卞垱涓庢姇绁細</strong>鍙戣捣鎶€鏈矙榫?鍒涘鏉炬彁妗堬紝鍙備笌鍏ㄥ憳姘戜富琛ㄥ喅</li>\n            <li><strong>馃挰 鎴愬憳浜ゆ祦鐣欒█锛?/strong>鍦ㄧぞ鍐呬氦娴佸尯鐣呰亰鎶€鏈紝鑾峰緱绠＄悊瀹樻柟鍥炲</li>\n            <li><strong>鈿?302鍒涘宸ュ潑锛?/strong>鍏ㄥぉ鍊欒嚜鐢变娇鐢ㄦ瀬瀹㈠伐浣嶄笌绉佹湁GPU绠楀姏闆嗙兢锛堥渶棰勭害锛?/li>\n          </ul>\n        </div>\n\n        <div style=\"background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 12px; padding: 20px 24px; margin: 22px 0;\">\n          <h3 style=\"margin: 0 0 10px 0; font-size: 16px; color: #1e40af;\">馃搶 涓嬩竴姝ヨ鍔ㄦ寚鍗?路 Onboarding Checklist</h3>\n          <ol style=\"margin: 0; padding-left: 20px; color: #1e3a5f; line-height: 2;\">\n            <li><strong>鐧诲綍涓汉涓績锛?/strong>浣跨敤褰撳墠璐﹀彿鐧诲綍 <a href=\"/profile\" style=\"color: #2563eb;\">瀹樼綉涓汉宸ヤ綔鍙?/a>锛屾煡鐪嬫柊韬唤鍑瘉</li>\n            <li><strong>鍔犲叆瀹樻柟鑱旂粶缇わ細</strong>QQ澶х兢 <strong style=\"background: #dbeafe; padding: 2px 8px; border-radius: 4px;\">889217643</strong>锛堝叆缇ゅ娉細濮撳悕+閮ㄩ棬鏂瑰悜锛?/li>\n            <li><strong>鍏虫敞杩庢柊娲诲姩锛?/strong>鐣欐剰杩戞湡绀惧洟鍏ㄥ憳杩庢柊澶т細涓庨儴闂ㄨ闈㈢牬鍐版矙榫欓€氱煡</li>\n            <li><strong>瀹屽杽涓汉璧勬枡锛?/strong>鍦ㄤ釜浜鸿缃腑琛ュ厖鎶€鏈爤銆丟itHub 鍦板潃绛変釜浜烘爣绛?/li>\n          </ol>\n        </div>\n\n        <p style=\"font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 28px; text-align: center;\">\n          馃殌 鏈熷緟鍦ㄦ湭鏉ョ殑鏃ュ瓙閲屼笌浣犲苟鑲╂帰绱?br/>\n          鍏卞悓鎵撻€犳牎鍥渶寮烘妧鏈瀬瀹㈢ぞ鍖猴紒\n        </p>\n\n        <div style=\"margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.8;\">\n          <div style=\"font-weight: 700; color: #64748b; font-size: 14px;\">澶у鍙戞槑鍒涙柊鍗忎細 路 鐞嗕簨浼?& 鎷涙柊宸ヤ綔缁?/div>\n          <div>馃摟 瀹樻柟閭锛歝ampus@geek.club &nbsp;|&nbsp; 馃寪 瀹樼綉锛氱櫥褰曚釜浜轰腑蹇冩煡鐪?/div>\n          <div style=\"margin-top: 8px;\">鏈偖浠剁敱绯荤粺鍦ㄥ鏍搁€氳繃鍚庤嚜鍔ㄥ彂閫侊紝璇峰嬁鐩存帴鍥炲</div>\n          <div style=\"font-size: 11px; color: #cbd5e1;\">Generated by Campus Club Management System v2.0</div>\n        </div>\n      </div>\n    </div>\n  ','simulated',NULL,'2026-09-13 06:37:29');
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
INSERT INTO `membership_applications` VALUES (2,5,'寮犺吘椋?,'鍐堕噾宸ョ▼瀛﹂櫌','鍨?42','123456','123456@qq.com','鍓嶆部鍏ㄦ爤涓嶢I鐮斿彂鏂瑰悜','',NULL,NULL,'approved',1,'鐜嬪織璞?,'娆㈣繋鍔犲叆绀惧洟锛屾湡寰呬綘鐨勭簿褰╄〃鐜帮紒','2026-09-13 14:37:29','2026-09-13 06:36:35'),(3,5,'寮犺吘椋?,'鍐堕噾宸ョ▼瀛﹂櫌','鍨?42','123456','123456@qq.com','鍒涙剰绛栧垝涓庡ぇ鍨嬫椿鍔ㄦ柟鍚?,'','鍙戞槑鍒涙柊鍗忎細2026-2027瀛﹀勾骞蹭簨鐣欎换鐢宠琛?docx','E:\\campus\\uploads\\submissions\\鍏ョぞ鐢宠_寮犺吘椋瀇1789310907330_5833.docx','pending',NULL,NULL,NULL,NULL,'2026-09-13 06:48:27');
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
  `tag` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '閫氱煡',
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
INSERT INTO `portal_config` VALUES (1,'鍙戞槑鍒涙柊鍗忎細','馃殌 2026 鐏儹绾虫柊涓?,'鍚开鍒涙柊鎬濈淮锛岄敾鐐煎疄璺佃兘鍔?,'','鍏充簬鍙戞槑鍒涙柊鍗忎細','瀹夊窘宸ヤ笟澶у鍙戞槑鍒涙柊鍗忎細瀹夊窘宸ヤ笟澶у鍙戞槑鍒涙柊鍗忎細鍒涚珛浜?2012 骞淬€傚湪姝ゅ崄骞村唴鎴戜滑绉夋壙鐫€ 鈥滃洟缁撱€佹眰瀹炪€佸嫟濂嬨€佸垱鏂扳€?鐨勬牎椋庡潥鎸?鈥滄爲绔嬫椂浠ｇ簿绁烇紝鍚开鍒涙柊鎬濈淮锛屾帰璁ㄥ鏈鐮旓紝閿荤偧瀹炶返鑳藉姏锛屽睍鐜颁釜浜洪閲囷紝涓板瘜鏍″洯鐢熸椿鈥?鐨勫畻鏃ㄣ€傛湰鍗忎細鑷村姏浜庡紑鎷撳垱鏂版€濈淮锛屾縺鍔变細鍛樼浉浜掍箣闂寸浉浜掓帰璁ㄥ鏈棶棰橈紝褰㈡垚鑹ソ鐨勫鏈皼鍥淬€傚湪鏃ュ父鐢熸椿涓畾鏈熶氦娴佽鎯筹紝涓嶆柇鎻愰珮浼氬憳鐨勫垱鏂拌兘鍔涳紝涓烘挵鍐欎笓鍒╂墦涓嬭壇濂藉熀纭€銆俓n\n鏈崗浼氳嚜鎴愮珛鑷充粖锛岀粍缁囦細鍛樿荡寰嬪笀浜嬪姟鎵€绀句細瀹炶返杩?50 娆★紝鎺堟潈涓撳埄杩?500 椤癸紱缁勭粐鍒涙柊鍩硅銆佸弻鍒涜禌浜?500 浣欐锛涜幏寰楀浗瀹剁骇銆佺渷绾т互鍙婃牎绾у椤?1000 浣欓」锛?019 - 2020 骞村害琚瘎涓?鈥滀紭绉€绀惧洟閮ㄢ€?鑽ｈ獕绉板彿锛?020 骞磋璇勪负 鈥滃叏鍥芥渶鍏峰奖鍝嶅姏鐨勫弻鍒涚ぞ鍥⑩€濓紝鍦?2022 - 2023 瀛﹀勾绗簩瀛︽湡瀹夊窘宸ヤ笟澶у绀惧洟鑱斿悎浼氫笟鍔℃妧鑳借瘎姣斿ぇ璧涗腑鑾峰緱涓€绛夊锛岃繛缁?9 骞磋幏寰?鈥滄牎鍗佷匠绀惧洟鈥?鑽ｈ獕绉板彿銆?,'[{\"label\":\"鍏ョぞ鑰冩牳閫氳繃鐜嘰",\"value\":\"88\",\"unit\":\"%\",\"icon\":\"users\"},{\"label\":\"鏂版寚鏍嘰",\"value\":\"100\",\"unit\":\"+\",\"icon\":\"calendar\"},{\"label\":\"鏂版寚鏍嘰",\"value\":\"100\",\"unit\":\"+\",\"icon\":\"award\"},{\"label\":\"鏂版寚鏍嘰",\"value\":\"100\",\"unit\":\"+\",\"icon\":\"layers\"}]','[{\"id\":\"tech\",\"name\":\"鎶€鏈爺鍙戦儴\",\"badge\":\"鏍稿績涓诲姏\",\"intro\":\"涓撴敞浜庡紑婧愰」鐩紑鍙慭",\"skills\":\"JavaScript / Python\",\"icon\":\"code\"}]','{\"email\":\"club@campus.edu\",\"qqGroup\":\"\",\"wechat\":\"\",\"location\":\"\"}','2026-09-10 08:30:22');
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
INSERT INTO `site_pages` VALUES (1,'棣栭〉','home','/',1,1,1,'楂樻牎绀惧洟瀹樻柟涓婚〉','楂樻牎绀惧洟瀹樻柟涓婚〉','','{\"badge\":\"\",\"bannerTitle\":\"\",\"bannerDescription\":\"\",\"introTitle\":\"\",\"introContent\":\"\",\"showHighlights\":false,\"showPillars\":false,\"showRecruitmentSteps\":true,\"showNotices\":true,\"aboutSectionTitle\":\"\",\"aboutSectionDescription\":\"\",\"highlight1Title\":\"\",\"highlight1Text\":\"\",\"highlight2Title\":\"\",\"highlight2Text\":\"\",\"highlight3Title\":\"\",\"highlight3Text\":\"\",\"pillarSectionTitle\":\"\",\"pillarSectionDescription\":\"\",\"pillar1Title\":\"\",\"pillar1Text\":\"\",\"pillar2Title\":\"\",\"pillar2Text\":\"\",\"pillar3Title\":\"\",\"pillar3Text\":\"\",\"pillar4Title\":\"\",\"pillar4Text\":\"\",\"recruitmentSectionTitle\":\"\",\"recruitmentSectionDescription\":\"\",\"noticeSectionTitle\":\"\",\"noticeSectionDescription\":\"\"}','2026-09-13 07:43:19','2026-09-13 07:43:19'),(2,'鍏充簬鎴戜滑','about','/about',1,1,2,'绀惧洟鍙戝睍鍘嗙▼銆佹枃鍖栫悊蹇典笌鑽ｈ獕浠嬬粛','绀惧洟鍙戝睍鍘嗙▼銆佹枃鍖栫悊蹇典笌鑽ｈ獕浠嬬粛','',NULL,'2026-09-13 07:43:19','2026-09-13 07:43:19'),(3,'绾虫柊閫氶亾','recruitment','/recruitment',1,1,3,'绀惧洟鎷涙柊鐢宠涓庢姤鍚嶉€氶亾','绀惧洟鎷涙柊鐢宠涓庢姤鍚嶉€氶亾','','{\"badge\":\"\",\"bannerTitle\":\"\",\"bannerDescription\":\"\",\"introTitle\":\"\",\"introContent\":\"\",\"showDownload\":true,\"showApplication\":true,\"showFaq\":false,\"downloadStepLabel\":\"\",\"applicationTitle\":\"\",\"applicationDescription\":\"\",\"faqTitle\":\"\",\"faq1Question\":\"\",\"faq1Answer\":\"\",\"faq2Question\":\"\",\"faq2Answer\":\"\",\"faq3Question\":\"\",\"faq3Answer\":\"\",\"faq4Question\":\"\",\"faq4Answer\":\"\"}','2026-09-13 07:43:19','2026-09-13 07:43:19'),(4,'閫氱煡鍏憡','notices','/notices',1,1,4,'绀惧洟鍏紑閫氱煡鍜屾垚鍛樺叕鍛?,'绀惧洟鍏紑閫氱煡鍜屾垚鍛樺叕鍛?,'',NULL,'2026-09-13 07:43:19','2026-09-13 07:43:19'),(5,'鑱旂郴鏂瑰紡','contact','/contact',1,1,5,'绀惧洟鑱旂郴鏂瑰紡涓庡湪绾垮挩璇?,'绀惧洟鑱旂郴鏂瑰紡涓庡湪绾垮挩璇?,'',NULL,'2026-09-13 07:43:20','2026-09-13 07:43:20');
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
INSERT INTO `system_settings` VALUES ('mock_mode','true','2026-09-13 06:45:10'),('registration_limit','1000','2026-09-16 06:11:12'),('smtp_host','smtp.qq.com','2026-09-13 06:45:10'),('smtp_pass','','2026-09-10 08:20:34'),('smtp_port','465','2026-09-13 06:45:10'),('smtp_secure','true','2026-09-13 06:45:10'),('smtp_sender_name','鍙戞槑鍒涙柊鍗忎細','2026-09-13 06:45:10'),('smtp_user','youth_geek_club@qq.com','2026-09-13 06:45:10');
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
INSERT INTO `users` VALUES (1,'鐜嬪織璞?,'superadmin@campus.club','$2b$10$NuJz5298YRC05TiwGm0tee.As1/ku1mm2vLglhLWFzKAaHS9K6SPK','鍐堕噾宸ョ▼瀛﹂櫌','鍨?45','100000001','super_admin','2026-09-10 08:20:34'),(5,'寮犺吘椋?,'123456@qq.com','$2b$10$Ev8QNNikMtnx/DW93jhx1utDYGhc6HxmAUE2gLNrm/PHrt81XKuJu','鍐堕噾宸ョ▼瀛﹂櫌','鍨?42','123456','admin','2026-09-13 06:33:16');
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

-- Dump completed on 2026-09-16 23:25:51
