# 🚀 The Awesome UIU - Future Plans & Roadmap

This document outlines planned features and improvements for The Awesome UIU platform.

---

## 📋 Current Roadmap

### 🎯 High Priority Features

#### 1. **Scholarship Probability Checker** 🔥
**Status:** Planning Phase  
**Estimated Timeline:** Q1 2025 (Priority: HIGH)

**Description:**
A crowd-sourced system where students can input their GPA to estimate their scholarship probability based on UIU's tier system (Top 2% = 100%, Top 3-5% = 50%, Top 6-10% = 25%). The system compares submitted GPAs to predict scholarship chances.

**Why This Feature:**
- ✅ Solves real student need (currently asked on social media)
- ✅ Viral potential - drives user engagement
- ✅ Easier to implement than lecturer reviews
- ✅ Network effect - more users = better accuracy
- ✅ Unique to UIU students

**Key Features:**
- ✅ Department-wise GPA submission
- ✅ Real-time percentile rank calculation
- ✅ Scholarship tier estimation (100%, 50%, 25%)
- ✅ GPA distribution visualization
- ✅ Confidence scoring based on sample size
- ✅ Historical semester comparisons
- ✅ Anonymous submissions (UIU email verified)
- ✅ Threshold displays (cutoff GPAs for each tier)
- ✅ Submission verification system (optional screenshot)
- ✅ Prevent duplicate submissions per semester
- ✅ Department statistics dashboard
- ✅ Social sharing (without revealing actual GPA)

**Technical Stack:**
- **Frontend:** Current HTML/CSS/JS setup
- **Backend:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (UIU email verification)
- **Hosting:** Netlify (frontend) + Supabase (backend)
- **Cost:** Free tier (can handle ~100K submissions)

**Database Schema:**
```sql
-- Scholarship Submissions Table
CREATE TABLE scholarship_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Student info (anonymous)
  user_id UUID, -- For preventing duplicate submissions
  department TEXT NOT NULL,
  semester TEXT NOT NULL, -- "Fall 2024", "Spring 2025"
  
  -- GPA data
  cgpa DECIMAL(4,2) NOT NULL CHECK (cgpa >= 0 AND cgpa <= 4.0),
  
  -- Verification (optional)
  is_verified BOOLEAN DEFAULT FALSE, -- If they upload result screenshot
  verification_image_url TEXT,
  
  -- Metadata
  submitted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent spam
  UNIQUE(user_id, semester, department)
);

-- Department Statistics (cached for performance)
CREATE TABLE department_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department TEXT NOT NULL,
  semester TEXT NOT NULL,
  
  total_submissions INTEGER DEFAULT 0,
  verified_submissions INTEGER DEFAULT 0,
  
  -- Percentile thresholds (CGPA cutoffs)
  top_2_percent_threshold DECIMAL(4,2),
  top_5_percent_threshold DECIMAL(4,2),
  top_10_percent_threshold DECIMAL(4,2),
  
  -- Statistics
  highest_cgpa DECIMAL(4,2),
  lowest_cgpa DECIMAL(4,2),
  average_cgpa DECIMAL(4,2),
  median_cgpa DECIMAL(4,2),
  
  -- Distribution (count of students in each range)
  range_4_00 INTEGER DEFAULT 0,
  range_3_75_3_99 INTEGER DEFAULT 0,
  range_3_50_3_74 INTEGER DEFAULT 0,
  range_3_25_3_49 INTEGER DEFAULT 0,
  range_3_00_3_24 INTEGER DEFAULT 0,
  range_below_3_00 INTEGER DEFAULT 0,
  
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(department, semester)
);

-- Historical Thresholds (for comparison)
CREATE TABLE historical_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department TEXT NOT NULL,
  semester TEXT NOT NULL,
  scholarship_tier INTEGER, -- 100, 50, 25
  minimum_cgpa DECIMAL(4,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Result Display Design:**
```
┌─────────────────────────────────────────────┐
│  📊 Your Estimated Scholarship Position      │
├─────────────────────────────────────────────┤
│                                              │
│  Your CGPA: 3.85                            │
│  Department: CSE                             │
│  Semester: Fall 2024                         │
│                                              │
│  🎯 Your Rank: Top 4.2%                     │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │ 🎓 Estimated Scholarship: 50%        │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  Scholarship Breakdown:                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  🟢 Top 2% (100%): CGPA ≥ 3.92             │
│  🟡 Top 3-5% (50%): CGPA 3.78-3.91  ← You  │
│  🟠 Top 6-10% (25%): CGPA 3.65-3.77        │
│  ⚪ Below Top 10%: No scholarship           │
│                                              │
│  📈 GPA Distribution Chart                  │
│  [Visual histogram showing all submissions]  │
│                                              │
│  📊 Statistics:                              │
│  • Based on 127 CSE students                │
│  • 89 verified submissions (70%)            │
│  • Confidence: ⭐⭐⭐⭐ (High)              │
│  • Highest: 4.00 | Average: 3.45            │
│                                              │
│  📅 Historical Comparison:                   │
│  • Spring 2024: Your GPA → 75% scholarship  │
│  • Fall 2023: Your GPA → 50% scholarship    │
│                                              │
│  ⚠️ IMPORTANT DISCLAIMER                    │
│  This is an ESTIMATE based on student       │
│  submissions. NOT official UIU calculator.  │
│  Actual results may vary based on total     │
│  enrollment and university criteria.        │
│                                              │
│  [Update My GPA]  [Share Result]  [Delete]  │
└─────────────────────────────────────────────┘
```

**Confidence Scoring System:**
```
Sample Size          Confidence Level
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
100+ submissions  →  ⭐⭐⭐⭐⭐ Very High
50-99            →  ⭐⭐⭐⭐ High
20-49            →  ⭐⭐⭐ Medium
10-19            →  ⭐⭐ Low
< 10             →  ⭐ Very Low (Unreliable)
```

**Implementation Phases:**

**Phase 1 - MVP (Week 1-2):**
1. Basic submission form (department, semester, CGPA)
2. Percentile rank calculation algorithm
3. Scholarship tier estimation
4. Simple results display with thresholds
5. Disclaimer warnings
6. One submission per user per semester

**Phase 2 - Enhanced (Week 3-4):**
1. GPA distribution histogram chart
2. Department statistics page
3. Confidence scoring display
4. Historical semester comparisons
5. Real-time updates when new submissions arrive
6. Sample size indicators

**Phase 3 - Advanced (Week 5-6):**
1. Verification system (upload result screenshot)
2. Social sharing functionality
3. Department leaderboard (anonymous top performers)
4. Animated rank reveal
5. Push notifications for rank changes
6. Export/download statistics

**Phase 4 - Intelligence (Future):**
1. ML-based prediction improvements
2. Trend analysis and forecasting
3. Email notifications for threshold changes
4. Comparative analytics across departments
5. Semester-to-semester improvement tracking

**Privacy & Anti-Spam Measures:**
- ✅ UIU email verification required
- ✅ One submission per student per semester
- ✅ No personally identifiable information stored
- ✅ Anonymous display of all statistics
- ✅ Option to delete submission anytime
- ✅ Rate limiting to prevent spam
- ✅ Flag suspicious patterns (e.g., multiple 4.00s from same IP)
- ✅ Admin moderation dashboard

**UI/UX Features:**
- ✅ Color-coded scholarship tiers (Green=100%, Yellow=50%, Orange=25%)
- ✅ Progress bars showing position
- ✅ Animated rank reveal on submission
- ✅ Confetti animation for top 2% 🎉
- ✅ Responsive design for mobile
- ✅ Dark mode support
- ✅ "You're doing better than X% of students!" encouragement

**Viral/Engagement Features:**
- ✅ "Share your achievement" (without revealing CGPA)
- ✅ "I'm in the top X%!" social media cards
- ✅ Real-time submission counter
- ✅ "3 students just submitted!" live updates
- ✅ Department vs department comparisons
- ✅ Motivation messages based on rank

**Cost Analysis:**
```
Supabase Free Tier Limits:
• 500MB database: ~100,000 submissions ✅
• 50K reads/day: More than sufficient ✅
• 2GB bandwidth/month: Adequate ✅
• Real-time subscriptions: Included ✅

TOTAL COST: $0 (FREE) 🎉
```

**Important Considerations:**
- ⚠️ **Legal Disclaimer:** Make it crystal clear this is NOT official
- ⚠️ **Sample Size:** Show warning if submissions < 20
- ⚠️ **Accuracy:** Results depend on participation rate
- ⚠️ **University Policy:** Check if UIU has any objections
- ⚠️ **Data Accuracy:** Students might input wrong GPAs
- ⚠️ **Semester Timing:** Most useful right after results are published

**Success Metrics:**
- Target: 50+ submissions per department per semester
- Minimum viable: 20+ submissions for meaningful data
- Ideal: 100+ submissions for high accuracy
- Viral coefficient: Expect 30-40% share rate

**Marketing Strategy:**
1. Launch right after semester results
2. Post in UIU Facebook groups
3. "Check your scholarship probability!" campaigns
4. Incentivize sharing (gamification)
5. Department ambassadors program

---

#### 2. **Lecturer Review System** 
**Status:** Planning Phase  
**Estimated Timeline:** Q2 2025

**Description:**
A comprehensive system where students can review and rate UIU lecturers to help fellow students make informed decisions about course selections.

**Key Features:**
- ✅ Lecturer profiles with courses taught
- ✅ Anonymous reviews with UIU email verification
- ✅ Multi-criteria rating system:
  - Teaching quality
  - Grading fairness
  - Accessibility and responsiveness
  - Course difficulty
  - Workload
- ✅ Advanced filtering:
  - By department
  - By course code
  - By semester
  - By rating
- ✅ Search functionality (lecturer name, course)
- ✅ Helpful review voting (upvote/downvote)
- ✅ Report inappropriate content
- ✅ Lecturer response feature
- ✅ Review moderation system

**Technical Stack:**
- **Frontend:** Current HTML/CSS/JS setup
- **Backend:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (UIU email verification)
- **Hosting:** Netlify (frontend) + Supabase (backend)
- **Cost:** Free tier (sufficient for ~10K reviews)

**Database Schema:**
```sql
-- Lecturers Table
CREATE TABLE lecturers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  department TEXT NOT NULL,
  designation TEXT,
  courses TEXT[], -- Array of course codes
  average_rating DECIMAL(3,2),
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecturer_id UUID REFERENCES lecturers(id),
  user_id UUID, -- Anonymous, but tracked to prevent spam
  course_code TEXT NOT NULL,
  
  -- Ratings (1-5 scale)
  teaching_quality INTEGER CHECK (teaching_quality BETWEEN 1 AND 5),
  grading_fairness INTEGER CHECK (grading_fairness BETWEEN 1 AND 5),
  accessibility INTEGER CHECK (accessibility BETWEEN 1 AND 5),
  course_difficulty INTEGER CHECK (course_difficulty BETWEEN 1 AND 5),
  workload INTEGER CHECK (workload BETWEEN 1 AND 5),
  overall_rating DECIMAL(3,2),
  
  -- Review content
  comment TEXT,
  pros TEXT,
  cons TEXT,
  tips TEXT,
  
  -- Engagement
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_reported BOOLEAN DEFAULT FALSE,
  report_count INTEGER DEFAULT 0,
  
  -- Metadata
  semester TEXT, -- e.g., "Fall 2024"
  is_anonymous BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Courses Table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- e.g., "CSE 1115"
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  credit_hours DECIMAL(3,1),
  course_type TEXT -- Theory/Lab/Sessional
);

-- Review Votes Table (to prevent duplicate voting)
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES reviews(id),
  user_id UUID,
  vote_type TEXT CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Reports Table
CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES reviews(id),
  reporter_id UUID,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending/reviewed/resolved
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation Steps:**
1. Set up Supabase project and database
2. Create database tables with Row Level Security (RLS)
3. Implement UIU email verification system
4. Build lecturer listing page with filters
5. Create review submission form
6. Implement search functionality
7. Add voting and reporting system
8. Build moderation dashboard
9. Add lecturer response feature
10. Implement analytics and insights

**Important Considerations:**
- ⚠️ Get permission from UIU administration
- ⚠️ Implement strict moderation policies
- ⚠️ Protect against spam and abuse
- ⚠️ Ensure student privacy
- ⚠️ Allow lecturers to view and respond to reviews
- ⚠️ Clear terms of service and community guidelines

---

### 🛠️ Tools Section Expansions

#### 2. **GPA Converter**
**Status:** Planned  
**Timeline:** Q2 2025

Convert between different GPA scales (4.0, 5.0, percentage, etc.)

**Features:**
- Multiple GPA scale support
- Percentage to GPA conversion
- Grade letter to GPA conversion
- Batch conversion

---

#### 3. **Credit Planner**
**Status:** Planned  
**Timeline:** Q2 2025

Plan semester courses and manage credit hours.

**Features:**
- Semester-wise course planning
- Credit hour tracking
- Course prerequisites checker
- Degree requirement tracker
- Graduation timeline calculator

---

#### 4. **Scholarship Calculator**
**Status:** Planned  
**Timeline:** Q3 2025

Calculate eligibility for UIU scholarship programs.

**Features:**
- Merit scholarship calculator
- Need-based scholarship checker
- Special scholarship eligibility
- Required CGPA projection
- Application deadline tracker

---

#### 5. **Course Prerequisite Checker**
**Status:** Planned  
**Timeline:** Q2 2025

Check if you've completed all prerequisites for a course.

**Features:**
- Course dependency tree
- Visual prerequisite map
- Eligible courses list
- Missing prerequisites tracker

---

#### 6. **Tuition Fee Calculator**
**Status:** Planned  
**Timeline:** Q3 2025

Calculate semester tuition fees based on credit hours and waivers.

**Features:**
- Per-credit cost calculation
- Scholarship/waiver deduction
- Payment plan options
- Total program cost estimation

---

### 📚 Resources Section Expansions

#### 7. **Lecture Notes Library**
**Status:** Planned  
**Timeline:** Q2 2025

Comprehensive database of student and faculty lecture notes.

**Features:**
- Upload and share notes
- Organize by course and topic
- Search and filter
- Quality rating system
- Download in multiple formats

**Technical Requirements:**
- File storage (Supabase Storage or Cloudinary)
- Document preview
- Version control
- Access permissions

---

#### 8. **Study Guides**
**Status:** Planned  
**Timeline:** Q3 2025

Curated study guides for better exam preparation.

**Features:**
- Topic-wise breakdowns
- Key concepts summary
- Practice problems
- Exam tips and strategies

---

#### 9. **Books & References Library**
**Status:** Planned  
**Timeline:** Q3 2025

Digital library of textbooks and reference materials.

**Features:**
- Book catalog by course
- Download or view online
- Book recommendations
- Student ratings and reviews

**Note:** Will require proper licensing and permissions for copyrighted materials.

---

#### 10. **Video Tutorials**
**Status:** Planned  
**Timeline:** Q4 2025

Curated video lessons and tutorials.

**Features:**
- Embedded YouTube playlists
- Course-specific video collections
- Student-created tutorials
- Timestamped topics

---

### 🎓 Community Features

#### 11. **Student Forum/Discussion Board**
**Status:** Planned  
**Timeline:** Q3 2025

Platform for students to ask questions and help each other.

**Features:**
- Question and answer system
- Topic categories
- Upvoting best answers
- Reputation system
- Verified answers from seniors/faculty

**Technical Stack:**
- Backend: Supabase or Firebase
- Real-time updates
- Markdown support
- Mention system

---

#### 12. **Course Review System**
**Status:** Planned  
**Timeline:** Q3 2025

Review courses (not just lecturers).

**Features:**
- Course difficulty rating
- Workload assessment
- Interest level
- Practical vs theoretical
- Prerequisites adequacy

---

#### 13. **Study Group Finder**
**Status:** Planned  
**Timeline:** Q4 2025

Find and create study groups for courses.

**Features:**
- Create/join study groups
- Schedule study sessions
- Group chat integration
- Resource sharing within groups

---

### 📱 Platform Improvements

#### 14. **Mobile App (PWA)**
**Status:** Planned  
**Timeline:** Q4 2025

Convert to Progressive Web App for better mobile experience.

**Features:**
- Offline functionality
- Push notifications
- Install on home screen
- Native app-like experience

---

#### 15. **User Accounts & Profiles**
**Status:** Planned (Required for many features)  
**Timeline:** Q1 2025

User authentication system for personalized experience.

**Features:**
- UIU email verification
- Profile customization
- Save preferences
- Track contribution history
- Achievement badges

**Technical Stack:**
- Supabase Auth or Firebase Auth
- OAuth for UIU email (@uiu.ac.bd)

---

#### 16. **Dark Mode**
**Status:** Planned  
**Timeline:** Q2 2025

Add dark theme option for better viewing experience.

---

#### 17. **Notifications System**
**Status:** Planned  
**Timeline:** Q3 2025

Notify users about new resources, updates, and deadlines.

**Features:**
- New resource alerts
- Deadline reminders
- Reply notifications
- Admin announcements

---

### 📊 Analytics & Insights

#### 18. **Academic Analytics Dashboard**
**Status:** Planned  
**Timeline:** Q4 2025

Visualize academic progress and trends.

**Features:**
- CGPA trend graphs
- Course performance comparison
- Semester-wise analytics
- Prediction models
- Goal tracking

---

### 🔧 Technical Improvements

#### 19. **API Development**
**Status:** Planned  
**Timeline:** Q3 2025

Create public APIs for developers.

**Features:**
- Course data API
- Grade calculation API
- Question bank API
- Rate limiting
- API documentation

---

#### 20. **Performance Optimization**
**Status:** Ongoing

Continuous improvement of site speed and performance.

**Tasks:**
- Lazy loading
- Image optimization
- Code splitting
- CDN integration
- Caching strategies

---

## 🎯 Long-term Vision

### Phase 1: Foundation (Current - Q2 2025)
- ✅ Core calculators and tools
- ✅ Question bank system
- 🔄 Lecturer review system
- 🔄 User authentication

### Phase 2: Community (Q2 - Q3 2025)
- Study resources expansion
- Discussion forums
- Study group features
- Course reviews

### Phase 3: Intelligence (Q4 2025 - Q1 2026)
- AI-powered recommendations
- Personalized study plans
- Predictive analytics
- Smart notifications

### Phase 4: Integration (Q2 2026+)
- UIU portal integration (if possible)
- Mobile apps (iOS/Android)
- Third-party integrations
- API marketplace

---

## 💡 Ideas Under Consideration

- **Job Board:** Campus job postings and career opportunities
- **Event Calendar:** University events, deadlines, and important dates
- **Alumni Network:** Connect with UIU alumni
- **Marketplace:** Buy/sell textbooks and course materials
- **Transport Coordination:** Share rides and find transport
- **Food Recommendations:** Campus cafeteria reviews and recommendations
- **Club & Society Hub:** Information about student clubs and activities
- **Lost & Found:** Campus lost and found system
- **Anonymous Feedback:** Submit feedback about campus facilities
- **Timetable Builder:** Create and share class schedules
- **Exam Countdown:** Track time until exams with study tips

---

## 🤝 How to Contribute

We welcome contributions from the UIU community! If you have:
- Feature suggestions
- Bug reports
- Resource contributions
- Technical expertise

Please reach out or submit a pull request on our GitHub repository.

---

## 📞 Contact & Feedback

- **GitHub:** [sadekinborno/Awesome-UIU](https://github.com/sadekinborno/Awesome-UIU)
- **Email:** [Your contact email]
- **Facebook Group:** [If applicable]

---

## 📝 Notes

- All features will prioritize student privacy and data security
- Free tier services will be used wherever possible
- Community moderation will be implemented for user-generated content
- All features will be mobile-responsive
- Accessibility standards will be maintained

---

*Last Updated: November 28, 2025*
