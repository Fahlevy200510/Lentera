# Catatan Evaluasi & Rekomendasi Taktis Naskah Presentasi Grand Final LIDM 2026

**Dokumen Acuan:** `Konsep PPT LIDM 2026 (jgn hapus).pdf`  
**Karya:** LENTERA — Pendamping Praktikum Sains Adaptif bagi Peserta Didik Tunanetra melalui Smart Tactile dan Context-Aware Learning  
**Divisi:** Inovasi Teknologi Digital Pendidikan (ITDP) — Puspresnas / Kemendiktisaintek  
**Penyusun Evaluasi:** AI Pair Programmer & Technical Coach LENTERA  
**Tanggal:** 8 November 2026  

---

## 1. Penilaian Umum & Keselarasan Rubrik (Overall Score: 9.5 / 10)

Naskah presentasi yang dirancang tim memiliki kualitas **sangat tinggi (level juara nasional)**. Naskah ini bukan sekadar kumpulan hafalan kalimat, melainkan **playbook taktis kompetisi** yang didesain secara presisi mengikuti matriks penilaian juri LIDM ITDP (Bobot 100: K1 Dampak 15%, K2 Permasalahan 10%, K3 Hasil Implementasi 25%, K4 Pengembangan 25%, K5 Validasi 25%).

### Keunggulan Kompetitif Terbesar:
1. **Kejujuran Ilmiah Tingkat Tinggi (*Radical Scientific Honesty*):** Tim secara sadar membedakan antara *Usabilitas* (SUS) dan *Hasil Belajar*, serta mengakui bahwa blok bersifat pasif dengan model inferensi digital graf (tanpa sensor arus fisik). Di hadapan dewan juri akademisi, pengakuan limitasi yang objektif ini justru memancarkan integritas ilmiah dan kematangan metodologi.
2. **Keterlibatan Pengguna Nyata (Luthfi) & SOP Etika Humanis:** Menghadirkan Luthfi mengunci 50% bobot kriteria inti (K3 & K4). Pendekatan fasilitasi berbasis ajakan/pertanyaan terbuka ("Luthfi mau modul apa?"), jeda sabar 3 detik, dan klausul hak berhenti sewaktu-waktu membuktikan empati desain inklusif yang tulus.
3. **Peta Waktu Ketat & Rencana Darurat (*Contingency Plan*):** Penataan durasi 09:15 (cadangan 45 detik) dengan rambu-rambu pemotongan kalimat jika terjadi keterlambatan di menit 03:30 atau 07:30 menjamin tim tidak akan terpotong bel waktu panitia.

---

## 2. Bedah Evaluasi per Segmen & Rekomendasi Taktis

### A. Drama Pembuka (00:00 – 00:40 · 40 Detik)
- **Status:** Sangat Efektif.
- **Kekuatan:** Menghadirkan kontras tajam antara *"guru menyuruh melihat gambar"* vs *"siswa tunanetra yang hanya bisa mendengar instruksi tanpa bisa memvalidasi hasil eksperimen secara mandiri"*.
- **Catatan & Rekomendasi:**
  - **Lembar A4 Skema Rangkaian:** Pastikan gambar skema rangkaian dicetak tebal dengan spidol hitam kontras atau print besar satu halaman penuh. Kertas ini mewakili "hambatan visual", sehingga harus terlihat jelas bahkan dari meja juri baris belakang.
  - **Opsi Intro Audio Alat:** Sangat disarankan memanfaatkan opsi audio klik balok + melodi buzzer alat selama 3–5 detik di awal drama. Rangsangan auditori di detik-detik pertama langsung membangun atmosfer teknologi pendamping tunanetra.

---

### B. Slide 01 & 02: Urgensi & Identifikasi Masalah (00:40 – 01:45 · 65 Detik) — *Lintang*
- **Kriteria Dikejar:** K2 Permasalahan (10%), K1 Dampak (15%).
- **Kekuatan:** Data 36% vs 8% anak disabilitas putus sekolah dari UNICEF/Bappenas membuka masalah secara makro, lalu disambung dengan temuan riil di SLB Negeri Semarang.
- **Catatan & Rekomendasi:**
  - **Penegasan "Secara Umum":** Pastikan Lintang tidak lupa menyebutkan frasa *"disabilitas secara umum"* agar juri bidang PLB/Kependidikan tidak memperdebatkan spesifikasi data tunanetra.
  - **Konsistensi Nama Mitra:** Sebutkan secara konsisten nama mitra studi kasus: **SLB Negeri Semarang**. Hindari mengarang tahapan observasi di luar dokumen laporan akhir.

---

### C. Slide 03: Ekosistem LENTERA (01:45 – 02:20 · 35 Detik) — *Fatih*
- **Kriteria Dikejar:** K2 Tujuan Belajar, K4 Pengembangan.
- **Kekuatan:** Fatih menyampaikan struktur komponen secara berurutan dan tenang (*satu, dua, tiga*).
- **Klarifikasi Penting mengenai Fitur "CLE" & "Dashboard":**
  - Pada halaman 17 buku konsep terdapat catatan: *"CLE dan Learning Analytics Dashboard tidak dijelaskan di laporan, juri akan mencari keduanya di demo."*
  - **Fakta di Sistem Web LENTERA:** Sistem web portal kita ([`Lentera-Portal`](file:///L:/LENTERA%20MALAYSIA/Lentera-Portal)) **SEBENARNYA SUDAH LENGKAP MEMILIKI FITUR TERSEBUT**:
    1. **Learning Analytics Dashboard:** Terletak di halaman [`/dashboard`](file:///L:/LENTERA%20MALAYSIA/Lentera-Portal/app/dashboard/page.tsx), lengkap dengan grafik durasi menit belajar mingguan, runtutan 7 hari, level XP, dan peta 6 keterampilan kelistrikan.
    2. **Rapor Siswa AI:** Modal cetak rapor pedagogis interaktif ([`StudentReportModal.tsx`](file:///L:/LENTERA%20MALAYSIA/Lentera-Portal/components/StudentReportModal.tsx)) siap diunduh/dicetak ke format PDF.
  - **Rekomendasi:** Fatih tetap membawakan naskah ringkas seperti yang tertulis, tetapi seluruh tim **wajib percaya diri** bahwa kedua fitur ini bukan klaim fiktif melainkan sudah berjalan nyata di sistem jika juri menanyakannya di sesi Q&A.

---

### D. Slide 04: Arsitektur LENTERA (02:20 – 03:30 · 70 Detik) — *Levy*
- **Kriteria Dikejar:** K3 Keunikan & Problem Solving (25%), K4 Kualitas Teknis (25%).
- **Kekuatan:** Penjelasan tiga lapis (*Perangkat Fisik $\to$ Pemrosesan Edge Raspberry Pi $\to$ Antarmuka Web & Audio*) sangat mudah dicerna juri non-teknis.
- **Catatan & Rekomendasi:**
  - **Posisi Kamera Bawah:** Tekankan kalimat *"Karena kamera berada di bawah papan, tangan dan jari siswa saat meraba komponen tidak akan pernah menutupi penanda ArUco"*. Ini poin pembeda terkuat dibanding sistem kamera overhead/webcam biasa.
  - **Blok Pasif & Keamanan:** Penegasan bahwa balok adalah pasif tanpa aliran listrik fisik menjelaskan solusi keselamatan total (*zero electrical shock hazard*).

---

### E. Slide 05: Demonstrasi Langsung bersama Luthfi (03:30 – 05:50 · 140 Detik) — *Birela*
- **Kriteria Dikejar:** K3 Hasil Implementasi (25%), K4 Fungsionalitas Demo (25%).
- **Kekuatan:** Demo fungsional nyata bersama siswa tunanetra.
- **Analisis Risiko & Protokol Penyelamatan Waktu:**
  - **Tantangan Durasi 140 Detik:** Alokasi 2 menit 20 detik untuk 6 langkah di panggung lomba sangat berisiko molor jika Luthfi membutuhkan waktu rabaan adaptasi meja baru.
  - **Protokol Pemotongan Taktis:**
    - Jika pada detik ke-100 (1 menit 40 detik) Luthfi masih meraba dan menyusun balok seri di papan, **Birela harus langsung melewati Tahap 5 (Tanya AI)**. Jangan memotong konsentrasi Luthfi merangkai komponen demi memaksakan fitur AI.
    - Keberhasilan Luthfi mendengar konfirmasi audio bahwa rangkaiannya *"Lampu Menyala / Rangkaian Tertutup"* adalah puncak penilaian juri.
  - **Sinkronisasi Baris 2 (Kecepatan Suara):** Di naskah Tahap 2 tertulis *"menaruh blok di baris kedua A2–E2"*. Pastikan saat latihan, respon suara alat langsung berganti tempo secara reaktif sesuai sistem audio rate 1.0x hingga 4.0x yang sudah diimplementasikan.

---

### F. Slide 06: Evaluasi & Pengembangan (05:50 – 06:30 · 40 Detik) — *Birela*
- **Kriteria Dikejar:** K5 Validasi, K4 Siklus Iterasi.
- **Kekuatan:** Menunjukkan proses *Design Science Research* yang berakar dari umpan balik pengguna asli (jarak Braille, 5 tingkat kecepatan suara, buku manual).
- **Catatan:** Jangan menyebut *"10 pengguna diwawancarai mendalam"*; tetap gunakan формула naskah: *"diuji pada 10 pengguna (5 siswa, 5 guru) dan wawancara mendalam dilakukan pada 2 guru"*.

---

### G. Slide 07: Hasil Pengujian SUS (06:30 – 07:45 · 75 Detik) — *Levy*
- **Kriteria Dikejar:** K5 Validasi Usabilitas (25%).
- **Kekuatan:** Lompatan skor SUS dari 78,50 (Baik) ke 91,50 (Unggul/Grade A) dengan kenaikan 13 poin terukur jelas.
- **Koreksi Angka Wajib (Halaman 17 Dokumen):**
  - Pastikan chart visual pada slide presentasi menampilkan angka rekapitulasi yang valid:
    - **Siswa:** 76,00 $\to$ 90,00
    - **Guru:** 81,00 $\to$ 93,00
    - **Gabungan:** 78,50 $\to$ 91,50
  - Angka butir Q3 (3,9 ke 4,6), Q5 (4,5 ke 5,0), dan Q9 (4,1 ke 4,3) sudah terverifikasi sinkron dengan laporan akhir.

---

### H. Slide 08 & 09: Dampak, Penutup, dan Kalimat Bersama (07:45 – 09:15 · 90 Detik)
- **Kriteria Dikejar:** K1 Dampak (15%), Kesan Akhir Kompak.
- **Kekuatan:** Fatih merangkum 3 penerima manfaat dan 4 langkah keberlanjutan. Lintang mengunci pesan filosofis inovasi.
- **Tiga Kalimat Serentak yang Wajib Dipertahankan:**
  1. *Awal (00:40):* "Kami Tim LENTERA, Universitas Diponegoro!"
  2. *Akhir Demo (05:47):* "Dari mendengar, menjadi melakukan!"
  3. *Penutup (09:00):* "LENTERA — sains yang dapat disentuh. Terang bagi semua!"

---

## 3. Strategi Menghadapi Sesi Tanya Jawab (Q&A 15 Menit)

Bank tanya jawab di halaman 18–19 PDF sudah mengantisipasi 90% pertanyaan kritis juri. Berikut penekanan taktis tambahan:

| Potensi Pertanyaan Juri | Pembicara Utama | Kunci Jawaban Penentu Skor |
| :--- | :---: | :--- |
| *"Apakah LENTERA sudah terbukti meningkatkan hasil belajar siswa?"* | **Birela** | **Jawab Jujur & Lugas:** *"Belum diukur secara sumatif. Yang terukur saat ini adalah Usabilitas (SUS 78,50 ke 91,50). Efektivitas belajar kognitif adalah agenda riset lanjutan dengan mengukur ketepatan tugas dan waktu mandiri siswa."* |
| *"Kenapa tidak memakai sensor sentuh atau pin tembaga di tiap balok?"* | **Levy** | *"Balok pasif menjamin keamanan mutlak bagi siswa tunanetra (tanpa arus listrik fisik), konstruksi bodi balok kokoh tanpa kabel putus, dan biaya cetak 3D sangat murah untuk replikasi sekolah."* |
| *"Bagaimana jika di ruangan lomba atau SLB tidak ada internet?"* | **Levy** | *"Deteksi kamera ArUco, pemetaan graf rangkaian, dan suara narator lokal berjalan 100% luring (offline) di Raspberry Pi. Hanya fitur tanya-jawab tutor AI yang memerlukan akses internet."* |
| *"Bagaimana guru memantau progres jika siswa belajar mandiri?"* | **Fatih / Lintang** | *"LENTERA menyediakan Learning Analytics Dashboard di web portal yang mencatat durasi praktik mingguan, riwayat pencapaian materi, hingga cetak Rapor Capaian Siswa berbasis AI."* |

---

## 4. Trik Panggung & Rekomendasi Hari H (Game Changer)

1. **Serahkan Buku Manual Fisik Ber-Braille ke Meja Juri:**
   - Saat 5 menit waktu transisi persiapan alat (sebelum timer 10 menit dinyalakan), salah satu anggota tim (Lintang/Fatih) dapat mendatangi meja juri dan **menyerahkan 1 eksemplar buku panduan fisik bertranskrip Braille dan huruf timbul**.
   - Ketika juri dapat meraba langsung buku tersebut selama tim berpresentasi, nilai kesiapan produk meningkat drastis.
2. **Kesiapan Jaringan Operator Laptop (Levy):**
   - Aktifkan hotspot smartphone mandiri ber-SSID `LENTERA` sebelum naik panggung.
   - Buka browser Chrome/Edge dan lakukan satu kali interaksi klik pada layar portal web agar kebijakan *Audio Autoplay* browser aktif dan suara narator tidak terblokir.
3. **Kenyamanan Luthfi di Ruang Tunggu:**
   - Lakukan orientasi rabaan papan di ruang transit (meja persiapan), bukan saat sudah di hadapan juri.
   - Pastikan pendamping dari pihak sekolah/wali selalu berada di radius pandang Luthfi.

---
*Catatan Integritas: Naskah presentasi ini berpegang teguh pada data mentah Laporan Akhir LENTERA tanpa ada manipulasi angka, selaras dengan semangat #TerangBagiSemua.*

