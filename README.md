<div align="center">

# 🎓 The Awesome UIU

### *Your Ultimate Student Hub for United International University*

### **🌐 [Visit Live Site: theawesomeuiu.netlify.app](https://theawesomeuiu.netlify.app/)**

---

[![Made for UIU](https://img.shields.io/badge/Made%20for-UIU%20Students-blue?style=for-the-badge)](https://www.uiu.ac.bd/)
[![Live Demo](https://img.shields.io/badge/Live-Demo-success?style=for-the-badge&logo=netlify)](https://theawesomeuiu.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)

**Making university life awesome with powerful tools, resources, and study materials!**

[📖 Documentation](#-features) • [🐛 Report Bug](../../issues) • [✨ Request Feature](../../issues)

---

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📊 CGPA Calculator
- ✅ Track semester performance
- ✅ Retake course support
- ✅ Auto-save functionality
- ✅ Real-time GPA calculation
- ✅ Grade distribution analytics

</td>
<td width="50%">

### 🎯 CGPA Goal Planner
- ✅ Target CGPA analysis
- ✅ Difficulty assessment
- ✅ Retake simulation
- ✅ Interactive GIF moments
- ✅ Beast mode challenges

</td>
</tr>
<tr>
<td width="50%">

### 📚 Question Banks
- ✅ Curated course materials
- ✅ Department-wise browsing
- ✅ Search functionality
- ✅ External repository integration
- ✅ Regular updates

</td>
</tr>
<tr>
<td width="50%">

### 🗓️ Academic Calendar
- ✅ Month view + upcoming list
- ✅ Shows single-day + multi-day events
- ✅ Admin panel CRUD + bulk import

</td>
<td width="50%">

### 🎨 Modern Design
- ✅ Dark-themed UI
- ✅ Smooth animations
- ✅ Parallax effects
- ✅ Gradient accents
- ✅ Professional aesthetics

</td>
<td width="50%">

### 📱 Fully Responsive
- ✅ Mobile optimized
- ✅ Tablet friendly
- ✅ Desktop enhanced
- ✅ Cross-browser support
- ✅ PWA ready

</td>
</tr>
</table>

### Academic Calendar setup (Supabase)
- Run [db/migrations/add-academic-calendar.sql](db/migrations/add-academic-calendar.sql) in Supabase SQL Editor
- Ensure admin auth foundation exists (run [db/migrations/admin-auth-setup.sql](db/migrations/admin-auth-setup.sql))
- Add events in the Admin panel: `admin-v2.html` → **Academic Calendar**

---

## 🎯 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Text editor (VS Code recommended)
- Git installed (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/the-awesome-uiu.git

# Navigate to project directory
cd the-awesome-uiu

# Open in browser
# Option 1: Double-click src/index.html
# Option 2: Use Live Server in VS Code
# Option 3: Deploy to GitHub Pages
```
---

## 📁 Project Structure

```
the-awesome-uiu/
├── 📂 src/
│   ├── 📄 index.html              # Landing page
│   ├── 📄 cgpa-calculator.html    # CGPA Calculator
│   ├── 📄 goal-planner.html       # CGPA Goal Planner
│   ├── 📄 question-banks.html     # Question Banks gateway
│   │
│   ├── 📂 css/
│   │   ├── 📄 landing.css         # Landing page styles
│   │   ├── 📄 styles.css          # Calculator styles
│   │   ├── 📄 goal-planner.css    # Goal planner styles
│   │   ├── 📄 question-banks.css  # Question banks styles
│   │   └── 📄 responsive.css      # Responsive breakpoints
│   │
│   ├── 📂 js/
│   │   ├── 📄 landing.js          # Landing page interactions
│   │   ├── 📄 main.js             # Calculator entry point
│   │   ├── 📄 calculator.js       # CGPA calculation logic
│   │   ├── 📄 gradeSystem.js      # Grading system definitions
│   │   ├── 📄 storage.js          # Local storage management
│   │   ├── 📄 goal-planner.js     # Goal planner logic
│   │   └── 📄 question-banks.js   # Question banks logic
│   │
│   └── 📂 assets/
│       ├── 📄 favicon.ico         # Site favicon
│       └── 📄 gigachad.mp3        # Epic music for beast mode
│
├── 📄 package.json                # Project metadata
├── 📄 .gitignore                  # Git ignore rules
├── 📄 LICENSE                     # MIT License
└── 📄 README.md                   # You are here!
```

---

## 🛠️ Tech Stack

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**Pure Vanilla Stack - No frameworks, maximum performance!**

</div>

### Core Technologies
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Grid, Flexbox, Animations
- **Vanilla JavaScript** - ES6+, LocalStorage API, DOM manipulation
- **Google Fonts** - Inter font family

### Key Features
- 🎨 CSS Grid & Flexbox layouts
- 🌈 CSS custom properties (variables)
- ✨ Keyframe animations
- 📱 Media queries (5 breakpoints)
- 💾 LocalStorage persistence
- 🎭 Intersection Observer API
- 🖱️ Event delegation patterns

---

## 🎨 Screenshots

<div align="center">

### 🏠 Landing Page
![Landing Page](https://via.placeholder.com/800x400/667eea/ffffff?text=Landing+Page+Screenshot)

### 📊 CGPA Calculator
![CGPA Calculator](https://via.placeholder.com/800x400/764ba2/ffffff?text=CGPA+Calculator+Screenshot)

### 📚 Question Banks
![Question Banks](https://via.placeholder.com/800x400/f093fb/ffffff?text=Question+Banks+Screenshot)

</div>

---

## 🎯 Usage Guide

### CGPA Calculator

1. **Enter Current Academic Standing**
   - Input total completed credits
   - Enter current CGPA

2. **Add Current Semester Courses**
   - Click "Add Course"
   - Enter course name, credits, and expected grade
   - Add multiple courses

3. **Calculate Results**
   - View potential semester GPA
   - See updated cumulative CGPA
   - Results auto-save to browser

4. **Handle Retakes** (Optional)
   - Enable retake mode for specific courses
   - Enter original and new grades
   - System calculates improvement impact

### Question Banks

1. **Browse Featured Courses**
   - View popular question banks
   - Click course cards to access materials

2. **Search Functionality**
   - Use search bar for specific courses
   - Filter by course code or name

3. **Access Materials**
   - Click "Browse Question Bank" 
   - Redirects to external repository
   - Contribute your own materials

---

## 🤝 Contributing

We love contributions! Help make The Awesome UIU even more awesome! 🚀

### Ways to Contribute

- 🐛 **Report bugs** - Found a bug? [Open an issue](../../issues/new)
- ✨ **Request features** - Have an idea? [Share it with us](../../issues/new)
- 📝 **Improve docs** - Documentation can always be better
- 🎨 **Design improvements** - Make it look even more awesome
- 💻 **Code contributions** - Fix bugs, add features
- 📚 **Add resources** - Share question banks, notes, study materials

### Contribution Process

1. **Fork the repository**
   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/sadekinborno/the-awesome-uiu.git
   cd the-awesome-uiu
   ```

3. **Create a branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Make your changes**
   - Write clean, documented code
   - Follow existing code style
   - Test thoroughly

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: amazing feature description"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Describe your changes

### Code Style Guidelines

- ✅ Use semantic HTML5 elements
- ✅ Follow BEM naming for CSS classes
- ✅ Write descriptive variable/function names
- ✅ Comment complex logic
- ✅ Test on multiple browsers
- ✅ Ensure mobile responsiveness

---

## 🌟 Contributors

Thanks to these awesome people who have contributed to this project! 🎉

<div align="center">

<!-- Add contributor avatars here once you have them -->
[![Contributors](https://img.shields.io/github/contributors/sadekinborno/the-awesome-uiu?style=for-the-badge)](../../graphs/contributors)

**Want to see your face here? [Start contributing!](#-contributing)**

</div>

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License - feel free to use this project for your university too! 
Just give credit where it's due. 😊
```

---

## 📞 Contact & Support

<div align="center">

**Made with ❤️ for UIU Students**

[![GitHub Issues](https://img.shields.io/github/issues/sadekinborno/the-awesome-uiu?style=for-the-badge)](../../issues)
[![GitHub Stars](https://img.shields.io/github/stars/sadekinborno/the-awesome-uiu?style=for-the-badge)](../../stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/sadekinborno/the-awesome-uiu?style=for-the-badge)](../../network/members)

### Need Help?

- 📧 **Email**: sadekinborno07@gmail.com
- 💬 **Issues**: [GitHub Issues](../../issues)
- 🌐 **Website**: [Live Demo](https://theawesomeuiu.netlify.app)

### Show Your Support

If this project helped you, give it a ⭐️! It motivates us to keep improving!

[![Star This Repo](https://img.shields.io/github/stars/sadekinborno/the-awesome-uiu?style=social)](../../stargazers)

</div>

---

## 🚀 Roadmap

### Current Version: v1.0
- ✅ CGPA Calculator
- ✅ CGPA Goal Planner with Beast Mode
- ✅ Question Banks Gateway
- ✅ Responsive Design
- ✅ Dark Theme UI

### Coming Soon: v2.0
- 📅 **Academic Calendar** - Track important dates
- 📊 **GPA to Percentage Converter** - Convert between grading systems
- 📚 **Lecture Notes** - Comprehensive study materials
- 💰 **Scholarship Probability Checker** - Check your scholarship eligibility *(See [docs/EMAIL_SETUP_GUIDE.md](docs/EMAIL_SETUP_GUIDE.md) for deployment)*
- 📖 **Study Guides** - Curated study resources
- 🏆 **Achievement Tracker** - Track your academic milestones

### Future Plans: v3.0+
- 🔐 **User Authentication** - Save data to cloud
- 📱 **Mobile App** - Native iOS/Android apps
- 🤝 **Study Groups** - Connect with classmates
- 📈 **Analytics Dashboard** - Visualize your progress
- 🔔 **Notifications** - Exam reminders & updates
- 🌐 **Multi-language** - Support for Bangla

**Want to help build these features? [Contribute now!](#-contributing)**

---

<div align="center">

### ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=sadekinborno/the-awesome-uiu&type=Date)](https://star-history.com/#sadekinborno/the-awesome-uiu&Date)

---

**Built with passion by UIU students, for UIU students** 🎓

**Making university life awesome, one tool at a time!** ✨

[⬆ Back to Top](#-the-awesome-uiu)

</div>