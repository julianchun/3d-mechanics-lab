// 每個動作的模型假設、已查證參考文獻（來自 docs/references.md 與 docs/machine-data.md）
// 以及與文獻趨勢比對狀態（由 npm run trends:json 產生的 src/trend-status.json 靜態匯入）
import trendStatus from './trend-status.json' with { type: 'json' };

// 所有動作共用的基礎模型假設
export const COMMON_ASSUMPTIONS = [
  '準靜態力學平衡（不含加速度、慣性與爆發力效應）。',
  '左右完全對稱（只計算右半身並鏡像，無法模擬單側動作或左右不對稱）。',
  '肌肉分配採最小化活化平方和之最佳化估計，不含疲勞、代謝累積與個人神經徵召差異。',
];

// 已查證之參考文獻庫（所有條目均取自 docs/references.md 與 docs/machine-data.md）
const REFS = {
  escamilla1998: { authors: 'Escamilla RF et al.', year: 1998, title: 'Biomechanics of the knee during closed kinetic chain and open kinetic chain exercises', venue: 'Med Sci Sports Exerc, 30(4):556–569', url: 'https://pubmed.ncbi.nlm.nih.gov/9565938/', tag: 'PubMed 9565938' },
  escamilla2001_sq: { authors: 'Escamilla RF', year: 2001, title: 'Knee biomechanics of the dynamic squat exercise', venue: 'Med Sci Sports Exerc, 33(1):127–141', url: 'https://pubmed.ncbi.nlm.nih.gov/11194098/', tag: 'PubMed 11194098' },
  escamilla2001_stance: { authors: 'Escamilla RF et al.', year: 2001, title: 'A three-dimensional biomechanical analysis of the squat during varying stance widths', venue: 'Med Sci Sports Exerc, 33(6):984–998', url: 'https://pubmed.ncbi.nlm.nih.gov/11404665/', tag: 'PubMed 11404665' },
  escamilla2001_var: { authors: 'Escamilla RF et al.', year: 2001, title: 'Effects of technique variations on knee biomechanics during the squat and leg press', venue: 'Med Sci Sports Exerc, 33(9):1552–1566', url: 'https://pubmed.ncbi.nlm.nih.gov/11528346/', tag: 'PubMed 11528346' },
  paoli2009: { authors: 'Paoli A, Marcolin G, Petrone N', year: 2009, title: 'The effect of stance width on the electromyographical activity of eight superficial thigh muscles during back squat with different bar loads', venue: 'J Strength Cond Res, 23(1):246–250', url: 'https://pubmed.ncbi.nlm.nih.gov/19130646/', tag: 'PubMed 19130646' },
  bryanton2012: { authors: 'Bryanton MA et al.', year: 2012, title: 'Effect of squat depth and barbell load on relative muscular effort in squatting', venue: 'J Strength Cond Res, 26(10):2820–2828', url: 'https://pubmed.ncbi.nlm.nih.gov/22797000/', tag: 'PubMed 22797000' },
  kubo2019: { authors: 'Kubo K, Ikebukuro T, Yata H', year: 2019, title: 'Effects of squat training with different depths on lower limb muscle volumes', venue: 'Eur J Appl Physiol, 119(9):1933–1942', url: 'https://pubmed.ncbi.nlm.nih.gov/31230110/', tag: 'PubMed 31230110' },
  illmeier2023: { authors: 'Illmeier G, Rechberger JS', year: 2023, title: 'The limitations of anterior knee displacement during different barbell squat techniques: A comprehensive review', venue: 'J Clin Med, 12(8):2955', url: 'https://pubmed.ncbi.nlm.nih.gov/37109294/', tag: 'PubMed 37109294' },
  vandentillaar2020: { authors: 'van den Tillaar R, Knutli TR, Larsen S', year: 2020, title: 'The effects of barbell placement on kinematics and muscle activation around the sticking region in squats', venue: 'Front Sports Act Living, 2:604177', url: 'https://pubmed.ncbi.nlm.nih.gov/33345183/', tag: 'PubMed 33345183' },
  glassbrook2017: { authors: 'Glassbrook DJ et al.', year: 2017, title: 'A review of the biomechanical differences between the high-bar and low-bar back-squat', venue: 'J Strength Cond Res, 31(9):2618–2634', url: 'https://pubmed.ncbi.nlm.nih.gov/28570490/', tag: 'PubMed 28570490' },
  glassbrook2019: { authors: 'Glassbrook DJ et al.', year: 2019, title: 'The high-bar and low-bar back-squats: A biomechanical analysis', venue: 'J Strength Cond Res, 33(Suppl 1):S1–S18', url: 'https://doi.org/10.1519/JSC.0000000000001836', tag: 'DOI' },
  murawa2020: { authors: 'Murawa M et al.', year: 2020, title: 'Muscle activation varies between high-bar and low-bar back squat', venue: 'PeerJ, 8:e9256', url: 'https://pubmed.ncbi.nlm.nih.gov/32551198/', tag: 'PubMed 32551198' },
  russell1989: { authors: 'Russell PJ, Phillips SJ', year: 1989, title: 'A preliminary comparison of front and back squat exercises', venue: 'Res Q Exerc Sport, 60(3):201–208', url: 'https://pubmed.ncbi.nlm.nih.gov/2489844/', tag: 'PubMed 2489844' },
  gullett2009: { authors: 'Gullett JC et al.', year: 2009, title: 'A biomechanical comparison of back and front squats in healthy trained individuals', venue: 'J Strength Cond Res, 23(1):284–292', url: 'https://pubmed.ncbi.nlm.nih.gov/19002072/', tag: 'PubMed 19002072' },
  yavuz2015: { authors: 'Yavuz HU et al.', year: 2015, title: 'Kinematic and EMG activities during front and back squat variations in maximum loads', venue: 'J Sports Sci, 33(10):1058–1066', url: 'https://pubmed.ncbi.nlm.nih.gov/25630691/', tag: 'PubMed 25630691' },
  krzyszkowski2020: { authors: 'Krzyszkowski J, Kipp K', year: 2020, title: 'Load-dependent mechanical demands of the lower extremity during the back and front squat', venue: 'J Sports Sci, 38(17):2005–2012', url: 'https://pubmed.ncbi.nlm.nih.gov/32544021/', tag: 'PubMed 32544021' },
  schwanbeck2009: { authors: 'Schwanbeck S, Chilibeck PD, Binsted G', year: 2009, title: 'A comparison of free weight squat to Smith machine squat using electromyography', venue: 'J Strength Cond Res, 23(9):2588–2591', url: 'https://pubmed.ncbi.nlm.nih.gov/19855308/', tag: 'PubMed 19855308' },
  lifefitness_smith: { authors: 'Hammer Strength / Life Fitness', year: null, title: 'Smith Machine（7° 傾斜滑軌規格）', venue: '原廠產品規格頁', url: 'https://www.lifefitness.com/en-us/catalog/strength-training/benches/smith-machine', tag: '原廠規格' },
  lifefitness_pulldown: { authors: 'Hammer Strength / Life Fitness', year: null, title: 'Select Lat Pulldown（HS-PD，1:1 滑輪下拉機規格）', venue: '原廠產品規格頁', url: 'https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/hammer-strength-select-lat-pulldown', tag: '原廠規格' },
  lifefitness_pulldown_row: { authors: 'Hammer Strength / Life Fitness', year: null, title: 'Pulldown Row（1:1 下拉與低拉划船機規格）', venue: '原廠產品規格頁', url: 'https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/hammer-strength-pulldown-row', tag: '原廠規格' },
  lifefitness_pwrplay: { authors: 'Life Fitness', year: null, title: 'PWR Play Cable Stations（1:1 低拉與 2:1 多功能可調滑輪柱規格）', venue: '原廠產品規格頁', url: 'https://www.lifefitness.com/en-us/catalog/strength-training/cable-machines-functional-trainers/pwr-play', tag: '原廠規格' },
  lifefitness_chestpress: { authors: 'Life Fitness', year: null, title: 'Insignia Series Chest Press（內聚弧線胸推機規格）', venue: '原廠產品規格頁', url: 'https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/insignia-series-chest-press', tag: '原廠規格' },
  dasilva2008: { authors: 'Da Silva EM et al.', year: 2008, title: 'Analysis of muscle activation during different leg press exercises at submaximum effort levels', venue: 'J Strength Cond Res, 22(4):1059–1065', url: 'https://pubmed.ncbi.nlm.nih.gov/18545207/', tag: 'PubMed 18545207' },
  cholewicki1991: { authors: 'Cholewicki J, McGill SM, Norman RW', year: 1991, title: 'Lumbar spine loads during the lifting of extremely heavy weights', venue: 'Med Sci Sports Exerc, 23(10):1179–1186', url: 'https://pubmed.ncbi.nlm.nih.gov/1758295/', tag: 'PubMed 1758295' },
  escamilla2000: { authors: 'Escamilla RF et al.', year: 2000, title: 'A three-dimensional biomechanical analysis of sumo and conventional style deadlifts', venue: 'Med Sci Sports Exerc, 32(7):1265–1275', url: 'https://pubmed.ncbi.nlm.nih.gov/10912892/', tag: 'PubMed 10912892' },
  escamilla2002: { authors: 'Escamilla RF et al.', year: 2002, title: 'An electromyographic analysis of sumo and conventional style deadlifts', venue: 'Med Sci Sports Exerc, 34(4):682–688', url: 'https://pubmed.ncbi.nlm.nih.gov/11932579/', tag: 'PubMed 11932579' },
  martinfuentes2020: { authors: 'Martín-Fuentes I, Oliva-Lozano JM, Muyor JM', year: 2020, title: 'Electromyographic activity in deadlift exercise and its variants. A systematic review', venue: 'PLoS ONE, 15(2):e0229507', url: 'https://pubmed.ncbi.nlm.nih.gov/32107499/', tag: 'PubMed 32107499' },
  rogacion2024: { authors: 'Rogacion CR et al.', year: 2024, title: 'Differences in Joint Kinematics and Electromyography Activity among the Conventional, Block, and Deficit Deadlifts（研討會摘要）', venue: 'IJES Conference Proceedings, 14(4):Article 68', url: 'https://digitalcommons.wku.edu/ijesab/vol14/iss4/68', tag: '研討會摘要' },
  mcallister2014: { authors: 'McAllister MJ et al.', year: 2014, title: 'Muscle activation during various hamstring exercises', venue: 'J Strength Cond Res, 28(6):1573–1580', url: 'https://pubmed.ncbi.nlm.nih.gov/24149748/', tag: 'PubMed 24149748' },
  vigotsky2015: { authors: 'Vigotsky AD, Harper EN, Ryan DR, Contreras B', year: 2015, title: 'Effects of load on good morning kinematics and EMG activity', venue: 'PeerJ, 3:e708', url: 'https://pubmed.ncbi.nlm.nih.gov/25653899/', tag: 'PubMed 25653899' },
  contreras2015: { authors: 'Contreras B et al.', year: 2015, title: 'A comparison of gluteus maximus, biceps femoris, and vastus lateralis electromyographic activity in the back squat and barbell hip thrust exercises', venue: 'J Appl Biomech, 31(6):452–458', url: 'https://pubmed.ncbi.nlm.nih.gov/26214739/', tag: 'PubMed 26214739' },
  krauseneto2020: { authors: 'Krause Neto W et al.', year: 2020, title: 'Gluteus maximus activation during common strength and hypertrophy exercises: A systematic review', venue: 'J Sports Sci Med, 19(1):195–203', url: 'https://pubmed.ncbi.nlm.nih.gov/32132843/', tag: 'PubMed 32132843' },
  collazogarcia2020: { authors: 'Collazo García CL et al.', year: 2020, title: 'Differences in the electromyographic activity of lower-body muscles in hip thrust variations', venue: 'J Strength Cond Res, 34(9):2449–2455', url: 'https://doi.org/10.1519/JSC.0000000000002859', tag: 'DOI' },
  kennedy2024: { authors: 'Kennedy D et al.', year: 2024, title: 'Electromyographic differences of the gluteus maximus, gluteus medius, biceps femoris, and vastus lateralis between the barbell hip thrust and barbell glute bridge', venue: 'Sports Biomech, 23(12):2935–2949', url: 'https://pubmed.ncbi.nlm.nih.gov/35586943/', tag: 'PubMed 35586943' },
  lehman2005: { authors: 'Lehman GJ', year: 2005, title: 'The influence of grip width and forearm pronation/supination on upper-body myoelectric activity during the flat bench press', venue: 'J Strength Cond Res, 19(3):587–591', url: 'https://pubmed.ncbi.nlm.nih.gov/16095407/', tag: 'PubMed 16095407' },
  saeterbakken2017: { authors: 'Saeterbakken AH et al.', year: 2017, title: 'The effects of bench press variations in competitive athletes on muscle activity and performance', venue: 'J Hum Kinet, 57:61–71', url: 'https://pubmed.ncbi.nlm.nih.gov/28713459/', tag: 'PubMed 28713459' },
  rodriguezridao2020: { authors: 'Rodríguez-Ridao D et al.', year: 2020, title: 'Effect of five bench inclinations on the electromyographic activity of the pectoralis major, anterior deltoid, and triceps brachii during the bench press exercise', venue: 'Int J Environ Res Public Health, 17(19):7339', url: 'https://doi.org/10.3390/ijerph17197339', tag: 'DOI' },
  lauver2016: { authors: 'Lauver JD, Cayot TE, Scheuermann BW', year: 2016, title: 'Influence of bench angle on upper extremity muscular activation during bench press exercise', venue: 'Eur J Sport Sci, 16(3):309–316', url: 'https://pubmed.ncbi.nlm.nih.gov/25799093/', tag: 'PubMed 25799093' },
  floorpress2026: { authors: 'JSCR', year: 2026, title: 'Isometric floor press: A valid, reliable, and practical field-based assessment of upper-body strength（等長測試研究）', venue: 'J Strength Cond Res', url: 'https://doi.org/10.1519/JSC.0000000000005585', tag: 'DOI' },
  schick2010: { authors: 'Schick EE et al.', year: 2010, title: 'A comparison of muscle activation between a Smith machine and free weight bench press', venue: 'J Strength Cond Res, 24(3):779–784', url: 'https://pubmed.ncbi.nlm.nih.gov/20093960/', tag: 'PubMed 20093960' },
  saeterbakken2011: { authors: 'Saeterbakken AH, van den Tillaar R, Fimland MS', year: 2011, title: 'A comparison of muscle activity and 1-RM strength of three chest-press exercises with different stability requirements', venue: 'J Sports Sci, 29(5):533–538', url: 'https://pubmed.ncbi.nlm.nih.gov/21225489/', tag: 'PubMed 21225489' },
  saeterbakken2013: { authors: 'Saeterbakken AH, Fimland MS', year: 2013, title: 'Effects of body position and loading modality on muscle activity and strength in shoulder presses', venue: 'J Strength Cond Res, 27(7):1824–1831', url: 'https://pubmed.ncbi.nlm.nih.gov/23096062/', tag: 'PubMed 23096062' },
  fenwick2009: { authors: 'Fenwick CMJ, Brown SHM, McGill SM', year: 2009, title: 'Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness', venue: 'J Strength Cond Res, 23(2):350–358', url: 'https://pubmed.ncbi.nlm.nih.gov/19197209/', tag: 'PubMed 19197209' },
  saeterbakken2015: { authors: 'Saeterbakken A et al.', year: 2015, title: 'The effect of performing bi- and unilateral row exercises on core muscle activation', venue: 'Int J Sports Med, 36(11):900–905', url: 'https://pubmed.ncbi.nlm.nih.gov/26134664/', tag: 'PubMed 26134664' },
  fischer2025: { authors: 'Fischer J et al.', year: 2025, title: 'Impact of different ranges of motion in the prone barbell row on muscle excitation', venue: 'J Electromyogr Kinesiol, 83:103025', url: 'https://pubmed.ncbi.nlm.nih.gov/40513198/', tag: 'PubMed 40513198' },
  kleiber2015: { authors: 'Kleiber T, Kunz L, Disselhorst-Klug C', year: 2015, title: 'Muscular coordination of biceps brachii and brachioradialis in elbow flexion with respect to hand position', venue: 'Front Physiol, 6:215', url: 'https://pubmed.ncbi.nlm.nih.gov/26300781/', tag: 'PubMed 26300781' },
  lehman2004: { authors: 'Lehman GJ et al.', year: 2004, title: 'Variations in muscle activation levels during traditional latissimus dorsi weight training exercises: An experimental study', venue: 'Dyn Med, 3(1):4', url: 'https://pubmed.ncbi.nlm.nih.gov/15228624/', tag: 'PubMed 15228624' },
  vasconcelos2023: { authors: 'de Abreu Vasconcelos CMW et al.', year: 2023, title: 'Effect of different grip position and shoulder-abduction angle on muscle strength and activation during the seated cable row', venue: 'Int J Strength Cond, 3(1)', url: 'https://doi.org/10.47206/ijsc.v3i1.190', tag: 'DOI' },
  padovan2025: { authors: 'Padovan R et al.', year: 2025, title: 'High-density surface electromyography excitation of prime movers in the narrow vs. wide grip seated row exercise', venue: 'J Hum Kinet', url: 'https://doi.org/10.5114/jhk/209550', tag: 'DOI' },
  mcallister2013: { authors: 'McAllister MJ et al.', year: 2013, title: 'Effect of grip width on electromyographic activity during the upright row', venue: 'J Strength Cond Res, 27(1):181–187', url: 'https://pubmed.ncbi.nlm.nih.gov/22362088/', tag: 'PubMed 22362088' },
  signorile2002: { authors: 'Signorile JF, Zink AJ, Szwed SP', year: 2002, title: 'A comparative electromyographical investigation of muscle utilization patterns using various hand positions during the lat pull-down', venue: 'J Strength Cond Res, 16(4):539–546', url: 'https://pubmed.ncbi.nlm.nih.gov/12423182/', tag: 'PubMed 12423182' },
  lusk2010: { authors: 'Lusk SJ, Hale BD, Russell DM', year: 2010, title: 'Grip width and forearm orientation effects on muscle activity during the lat pull-down', venue: 'J Strength Cond Res, 24(7):1895–1900', url: 'https://pubmed.ncbi.nlm.nih.gov/20543740/', tag: 'PubMed 20543740' },
  andersen2014: { authors: 'Andersen V et al.', year: 2014, title: 'Effects of grip width on muscle strength and activation in the lat pull-down', venue: 'J Strength Cond Res, 28(4):1135–1142', url: 'https://pubmed.ncbi.nlm.nih.gov/24662157/', tag: 'PubMed 24662157' },
  knapik1983: { authors: 'Knapik JJ et al.', year: 1983, title: 'Isometric, isotonic, and isokinetic torque variations in four muscle groups through a range of joint motion', venue: 'Phys Ther, 63(6):938–947', url: 'https://pubmed.ncbi.nlm.nih.gov/6856681/', tag: 'PubMed 6856681' },
  kulig1984: { authors: 'Kulig K, Andrews JG, Hay JG', year: 1984, title: 'Human strength curves', venue: 'Exerc Sport Sci Rev, 12:417–466', url: 'https://pubmed.ncbi.nlm.nih.gov/6376139/', tag: 'PubMed 6376139' },
  marginson2001: { authors: 'Marginson V, Eston R', year: 2001, title: 'The relationship between torque and joint angle during knee extension in boys and men', venue: 'J Sports Sci, 19(11):875–880', url: 'https://pubmed.ncbi.nlm.nih.gov/11695509/', tag: 'PubMed 11695509' },
  folland2008: { authors: 'Folland JP, Morris B', year: 2008, title: 'Variable-cam resistance training machines: do they match the angle-torque relationship in humans?', venue: 'J Sports Sci, 26(2):163–169', url: 'https://pubmed.ncbi.nlm.nih.gov/17885926/', tag: 'PubMed 17885926' },
  dacosta2026: { authors: 'da Costa-Machado RA et al.', year: 2026, title: 'Validation of a Novel Variable-Cam System: Electromyographic and Kinetic Analysis', venue: 'Applied Sciences, 16(6):2633', url: 'https://doi.org/10.3390/app16062633', tag: 'DOI' },
  onishi2002: { authors: 'Onishi H et al.', year: 2002, title: 'EMG-angle relationship of the hamstring muscles during maximum knee flexion', venue: 'J Electromyogr Kinesiol, 12(5):399–406', url: 'https://pubmed.ncbi.nlm.nih.gov/12223173/', tag: 'PubMed 12223173' },
  beyer2019: { authors: 'Beyer EB, Lunden JB, Russell Giveans M', year: 2019, title: 'Medial and lateral hamstrings response and force production at varying degrees of knee flexion and tibial rotation in healthy individuals', venue: 'Int J Sports Phys Ther, 14(3):376–383', url: 'https://pubmed.ncbi.nlm.nih.gov/31681497/', tag: 'PubMed 31681497' },
  maeo2021: { authors: 'Maeo S et al.', year: 2021, title: 'Greater hamstrings muscle hypertrophy but similar damage protection after training at long versus short muscle lengths', venue: 'Med Sci Sports Exerc, 53(4):825–837', url: 'https://pubmed.ncbi.nlm.nih.gov/33009197/', tag: 'PubMed 33009197' },
  maeo2023: { authors: 'Maeo S et al.', year: 2023, title: 'Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position', venue: 'Eur J Sport Sci, 23(7):1240–1250', url: 'https://pubmed.ncbi.nlm.nih.gov/35819335/', tag: 'PubMed 35819335' },
  hussain2020: { authors: 'Hussain J et al.', year: 2020, title: 'Muscle fatigue in the three heads of triceps brachii during intensity and speed variations of triceps push-down exercise', venue: 'Front Physiol, 11:112', url: 'https://pubmed.ncbi.nlm.nih.gov/32153422/', tag: 'PubMed 32153422' },
  oliveira2009: { authors: 'Oliveira AS, Gonçalves M', year: 2009, title: 'Positioning during resistance elbow flexor exercise affects electromyographic activity, heart rate, and perceived exertion', venue: 'J Strength Cond Res, 23(3):854–862', url: 'https://pubmed.ncbi.nlm.nih.gov/19387393/', tag: 'PubMed 19387393' },
  marcolin2018: { authors: 'Marcolin G et al.', year: 2018, title: 'Differences in electromyographic activity of biceps brachii and brachioradialis while performing three variants of curl', venue: 'PeerJ, 6:e5165', url: 'https://pubmed.ncbi.nlm.nih.gov/30013836/', tag: 'PubMed 30013836' },
  andersen2008: { authors: 'Andersen LL et al.', year: 2008, title: 'Muscle activation during selected strength exercises in women with chronic neck muscle pain', venue: 'Phys Ther, 88(6):703–711', url: 'https://pubmed.ncbi.nlm.nih.gov/18339796/', tag: 'PubMed 18339796' },
  pizzari2014: { authors: 'Pizzari T et al.', year: 2014, title: 'Modifying a shrug exercise can facilitate the upward rotator muscles of the scapula', venue: 'Clin Biomech, 29(2):201–205', url: 'https://pubmed.ncbi.nlm.nih.gov/24342452/', tag: 'PubMed 24342452' },
  rochajunior2007: { authors: 'Rocha Júnior VA, Gentil P, Oliveira E, do Carmo J', year: 2007, title: 'Comparison among the EMG activity of the pectoralis major, anterior deltoidis and triceps brachii during the bench press and peck deck exercises', venue: 'Rev Bras Med Esporte, 13(1):43–46', url: 'https://doi.org/10.1590/S1517-86922007000100012', tag: 'DOI' },
  gentil2007: { authors: 'Gentil P, Oliveira E, de Araújo Rocha Júnior V, do Carmo J, Bottaro M', year: 2007, title: 'Effects of exercise order on upper-body muscle activation and exercise performance', venue: 'J Strength Cond Res, 21(4):1082–1086', url: 'https://pubmed.ncbi.nlm.nih.gov/18076251/', tag: 'PubMed 18076251' },
  welsch2005: { authors: 'Welsch EA, Bird MJ, Mayhew JL', year: 2005, title: 'Electromyographic activity of the pectoralis major and anterior deltoid muscles during three upper-body lifts', venue: 'J Strength Cond Res, 19(2):449–452', url: 'https://pubmed.ncbi.nlm.nih.gov/15903389/', tag: 'PubMed 15903389' },
  solstad2020: { authors: 'Solstad TE et al.', year: 2020, title: 'A comparison of muscle activation between barbell bench press and dumbbell flyes in resistance-trained males', venue: 'J Sports Sci Med, 19(4):645–651', url: 'https://pubmed.ncbi.nlm.nih.gov/33239937/', tag: 'PubMed 33239937' },
  lee2019: { authors: 'Lee HM', year: 2019, title: 'Force direction and arm position affect contribution of clavicular and sternal parts of pectoralis major muscle during muscle strength testing', venue: 'J Hand Ther, 32(1):71–79', url: 'https://pubmed.ncbi.nlm.nih.gov/28943236/', tag: 'PubMed 28943236' },
  ackland2008: { authors: 'Ackland DC, Pak P, Richardson M, Pandy MG', year: 2008, title: 'Moment arms of the muscles crossing the anatomical shoulder', venue: 'J Anat, 213(4):383–390', url: 'https://pubmed.ncbi.nlm.nih.gov/18691376/', tag: 'PubMed 18691376' },
  signorile2017: { authors: 'Signorile JF et al.', year: 2017, title: 'Differences in muscle activation and kinematics between cable-based and selectorized weight training', venue: 'J Strength Cond Res, 31(2):313–322', url: 'https://pubmed.ncbi.nlm.nih.gov/28129277/', tag: 'PubMed 28129277' },
};

// 以清單 ID 為鍵的動作假設與參考文獻
export const SOURCES = {
  'squat-high': {
    assumptions: [
      '站姿動作：每幀求解軀幹前傾角，使系統總重心（含實際三維手臂位置與槓鈴）維持在腳掌中段上方。',
      '站距小腿角項：寬站距（stance = 0.9）小腿較窄站距（0.1）直立 6.7°（依 Escamilla et al. 2001, PMID 11404665 量測 5–9°）；已知限制：在固定腳掌中段重心下，寬站距股骨矢狀投影縮短使模型軀幹反少傾約 16° 且髖伸力矩下降（與該文獻軀幹無差異、髖力矩較高之結果矛盾），且缺少髖外旋與臀大肌上束外展力臂。',
      '額狀面地面反作用力假設通過髖關節（外推膝蓋參數則額外施加橫向分力）；槓重 1.0× 體重為示範負重假設，僅分析下肢與腰椎自由度。',
    ],
    refs: ['escamilla1998', 'escamilla2001_sq', 'escamilla2001_stance', 'escamilla2001_var', 'paoli2009', 'bryanton2012', 'kubo2019', 'illmeier2023'],
  },
  'squat-low': {
    assumptions: [
      '低槓位置下移至三角肌後束（較高槓低 8 cm、靠後 3.5 cm），另加入下肢策略偏移（domShift = +0.08，依 van den Tillaar 2020、Murawa 2020、Glassbrook 2017、Illmeier & Rechberger 2023 反推，使最低點小腿較高槓直立約 1.9°、軀幹多前傾約 12.3°）。',
      '站姿總重心（含實際三維手臂位置）維持在腳掌中段上方；站距小腿角項與額狀面地面反作用力假設同高槓深蹲。',
      '槓重為 1.0× 體重示範假設，與高槓同負重下比較力臂差異。',
    ],
    refs: ['glassbrook2017', 'glassbrook2019', 'murawa2020', 'vandentillaar2020', 'illmeier2023', 'escamilla2001_stance'],
  },
  'front-squat': {
    assumptions: [
      '前槓架在三角肌前束上方（軀幹軸前方 11 cm），另加入下肢策略偏移（domShift = -0.08，依 Illmeier & Rechberger 2023、Yavuz 2015、Russell & Phillips 1989 反推，使最低點軀幹較高槓直立約 15.8°、小腿微多前傾約 1.9°）。',
      '站姿總重心以實際三維手臂（前架式前伸手肘）位置計入平衡，維持在腳掌中段上方；站距小腿角項與額狀面反作用力假設同背蹲。',
      '槓重採相同 1.0× 體重示範假設，以比較相同絕對負重下的關節力矩（Krzyszkowski & Kipp 2020）。',
    ],
    refs: ['gullett2009', 'yavuz2015', 'krzyszkowski2020', 'illmeier2023', 'russell1989', 'escamilla2001_stance'],
  },
  'smith-squat': {
    assumptions: [
      '雙接觸點反作用力（腳底＋滑軌法向反作用力），假設線性軸承滑軌無摩擦（μ = 0）且可推可拉。',
      '軌道傾角提供 0°（垂直）與 ±7°（Hammer Strength 官方規格）；示範總負重（0.9× 體重）為假設。',
      '腳底壓力中心由「用力點」參數決定，重心不必落在腳掌正上方。',
    ],
    refs: ['schwanbeck2009', 'lifefitness_smith'],
  },
  'leg-press': {
    assumptions: [
      '坐姿器械：椅背與座墊承擔身體重量，不算地面反作用力。',
      '滑台只沿 45° 軌道方向出力；預設導軌摩擦 μ = 0 為準靜態參考（sin 45°），設定 μ 時代表向心階段的上限（sinθ + μcosθ），離心時為 sinθ − μcosθ。',
      '空滑台重量（預設 45 kg）、導軌摩擦係數範圍（0–0.15）與椅背角度範圍屬常見商用假設，未查得單一原廠實測值。',
    ],
    refs: ['escamilla1998', 'escamilla2001_var', 'dasilva2008'],
  },
  deadlift: {
    assumptions: [
      '槓沿腳掌中段垂直移動；槓貼近身體時，假設小腿／大腿可向前頂住槓身減少手臂前拉需求。',
      '站姿地面反作用力維持系統平衡；示範負重 1.2× 體重為假設。',
    ],
    refs: ['cholewicki1991', 'escamilla2000', 'escamilla2002', 'martinfuentes2020'],
  },
  'deficit-dl': {
    assumptions: [
      '站在墊高台上使起始踝、膝、髖屈曲增加；其餘接觸與力學假設同傳統硬舉。',
      '目前尚無同儕審查期刊全文直接比較赤字／傳統／墊高硬舉，文獻比對僅採研討會摘要初步證據。',
    ],
    refs: ['rogacion2024', 'martinfuentes2020'],
  },
  'block-pull': {
    assumptions: [
      '槓片架在墊塊上縮短起始行程；其餘接觸與力學假設同傳統硬舉。',
      '目前尚無同儕審查期刊全文直接比較赤字／傳統／墊高硬舉，文獻比對僅採研討會摘要初步證據。',
    ],
    refs: ['rogacion2024', 'martinfuentes2020'],
  },
  sumo: {
    assumptions: [
      '寬站距與腳尖外轉 40° 縮短槓與髖水平距離並使軀幹更直立；其餘力學假設同傳統硬舉。',
      '與傳統硬舉採相同 1.2× 體重示範負重進行比較。',
    ],
    refs: ['escamilla2000', 'escamilla2002', 'cholewicki1991'],
  },
  rdl: {
    assumptions: [
      '膝彎曲角全程固定，以髖鉸鏈為主；槓貼近腿部時假設腿前緣可提供水平接觸反力。',
      '示範負重 0.9× 體重為假設。',
    ],
    refs: ['mcallister2014', 'martinfuentes2020'],
    trendNote: '已有肌電文獻支持 RDL 高膕繩肌活化與拉長張力，目前尚未列入自動化趨勢比對項目。',
  },
  'good-morning': {
    assumptions: [
      '槓扛在上背，膝彎曲固定後以髖後推維持系統重心在腳掌中段上方。',
      '示範負重 0.45× 體重為假設；膝彎曲對膕繩肌長度之比較屬幾何推論。',
    ],
    refs: ['vigotsky2015', 'mcallister2014'],
  },
  'hip-thrust': {
    assumptions: [
      '雙接觸點反作用力（腳底＋臥推椅上背肩胛下角支撐），假設椅墊摩擦係數 μ = 0.5（無出處假設），水平力優先由背部摩擦承擔。',
      '槓重設為 1.7× 體重（參考 Contreras et al. 2015 之 10RM 臀推／背蹲比 ≈ 1.64×〔非體重倍數〕與 Kennedy et al. 2024 之 5RM 1.71× 體重；註：兩篇負重數字未能從付費全文核對，係見作者公開摘錄／ResearchGate 摘要，採此值以反映臀推負重高於深蹲之實務比例），作用於骨盆區段；標準槓片半徑 22.5 cm 限制最低下放深度。',
    ],
    refs: ['contreras2015', 'krauseneto2020', 'collazogarcia2020', 'kennedy2024'],
  },
  'glute-bridge': {
    assumptions: [
      '地板連續平面支撐模型：以肩線貼地（0.50 m）取代臥推椅支點，貼地之上半身與手臂重量由接觸區段正下方地板直接承載，其餘橋式反力集中於離地前緣並以軟最小（0.03 m）平滑過渡至 L5；上胸椎貼地段（floorFlat = 0.16 m）與軟組織／地墊厚度（floorPad = 0.04 m）為解剖估計，地板摩擦係數 μ = 0.5 為無出處假設。',
      '骨盆高於肩（psi < 0）時由雙手扶穩，使槓維持在髖屈褶皺處而不往腹部滑落。',
      '槓重設為 1.83× 體重（參考 Kennedy et al. 2024 之 5RM 1.83× 體重；註：負重數字未能從付費全文核對，係見 ResearchGate 摘要與同團隊論文，採此值以反映臀橋短行程可承載較高負荷之實務排序）。',
    ],
    refs: ['kennedy2024', 'contreras2015'],
  },
  bench: {
    assumptions: [
      '仰臥於臥推椅（不算地面反作用力），僅分析肩屈伸、肩水平內收與肘伸展。',
      '模型不含肱骨內外旋自由度（旋轉肌袖以水平內收軸近似）；示範負重 0.8× 體重為假設。',
    ],
    refs: ['lehman2005', 'saeterbakken2017', 'rodriguezridao2020'],
  },
  'incline-bench': {
    assumptions: [
      '椅背上斜 30°（整組軀幹與觸胸座標隨椅背旋轉），不算地面反作用力。',
      '已知限制：上斜臥推前臂會偏離垂直約 20°；不含肱骨內外旋自由度。',
    ],
    refs: ['lauver2016', 'rodriguezridao2020'],
  },
  'cg-bench': {
    assumptions: [
      '窄握（1.0× 肩寬）與較小手肘外開角（32°），僅分析肩屈伸、肩水平內收與肘伸展。',
      '已知限制：窄握時模型胸大肌估計偏低；不含肱骨內外旋自由度。',
    ],
    refs: ['lehman2005', 'saeterbakken2017'],
  },
  'floor-press': {
    assumptions: [
      '背平貼地面不拱背，行程下放到上臂肘關節碰地（離地 4.5 cm）即止擋。',
      '目前未找到動態地板臥推與平板臥推之同儕審查 EMG 或逆動力學對照全文（僅查得等長測試研究）。',
    ],
    refs: ['floorpress2026'],
    noStudy: true,
    trendNote: '尚無直接比較動態地板臥推與平板臥推之同儕審查肌電／逆動力學研究。',
  },
  'chest-press': {
    assumptions: [
      '坐姿器械：椅背承擔身體重量，不算地面反作用力；僅分析肩屈伸、肩水平內收與肘伸展。',
      '直線軌跡沿固定前方出力；內聚弧線假設推直時雙手寬度收攏至起始 72%（對應商用內聚胸推機運動學概念，尚未查得直接 EMG 對照論文）。',
      '機械止擋限制手肘不穿透椅背（肩後方 8.5 cm）；示範配重 0.9× 體重為假設。',
    ],
    refs: ['schick2010', 'saeterbakken2011', 'lifefitness_chestpress'],
    trendNote: '直接比較坐姿胸推機（含內聚 vs 直線）之同儕審查研究較稀缺，主要參考固定軌跡胸推與自由臥推研究，尚未列入自動趨勢比對。',
  },
  'pec-deck': {
    assumptions: [
      '坐姿器械：椅背承擔身體重量與肩胛穩定反力，不算地面反作用力；分析肩三維自由度（shFwd、shSide、shRot）與肘屈伸。',
      '機械臂繞位於肩關節正上方附近的垂直軸轉動，阻力方向為機械臂水平圓弧切線（反於水平內收）。',
      '握把式（手臂微彎）施力點在手掌，需屈肘肌等長維持肘角；前臂墊式（屈肘 90°）施力點在前臂中段且垂直於屈肘平面，幾乎無屈肘力矩需求但產生肩內旋力矩需求。',
      '機械臂半徑（握把 54 cm／前臂墊 29 cm）、等效凸輪基準力臂（22 cm）、溫和鐘型凸輪曲線表與預設配重（45 kg）皆為假設（未查得單一商用機台實測凸輪表）。',
    ],
    refs: ['rochajunior2007', 'welsch2005', 'solstad2020', 'ackland2008'],
  },
  'cable-fly-high': {
    assumptions: [
      '站姿雙側獨立滑輪（高位滑輪 192 cm，左右柱距 260 cm），每手各握獨立把手連向同側滑輪，不套用剛體握把互推。',
      '兩側鋼索的左右分量（X）對稱相消；前後與上下分量（Y、Z）計入站姿重心與壓力中心平衡。受限於左右對稱模型，採雙腳併站並以軀幹前傾維持平衡（實務上建議前後腳分站）。',
      '手肘維持固定微彎角並對齊鋼索力線平面（S–手–滑輪共面），符合教學原則並減少肩關節異常扭轉力矩；滑輪比預設 2:1（Life Fitness 可調滑輪柱主流規格），單側示範配重 18 kg（2:1 實感單手 9 kg）與機架尺寸為假設。',
      '目前缺乏直接於同儕審查期刊比較高／中／低三檔動態滑輪夾胸之 EMG 全文，高位偏中下胸、低位偏上胸之趨勢主要依據斜向水平內收等長 EMG（Lee 2019）、肩關節力臂（Ackland 2008）與臥推傾角研究（Rodríguez-Ridao 2020）間接支持。',
    ],
    refs: ['lee2019', 'ackland2008', 'rodriguezridao2020', 'signorile2017', 'lifefitness_pwrplay'],
  },
  'cable-fly-mid': {
    assumptions: [
      '站姿雙側獨立滑輪（中位滑輪 134 cm，與肩約同高；左右柱距 260 cm），每手各握獨立把手，不套用剛體握把互推。',
      '兩側鋼索左右分量相消，前後分量影響壓力中心；採雙腳併站與軀幹前傾平衡（實務上建議前後腳分站）。',
      '滑輪比預設 2:1，單側示範配重 18 kg（實感單手 9 kg）與機架尺寸為假設。',
    ],
    refs: ['lee2019', 'ackland2008', 'signorile2017', 'welsch2005', 'lifefitness_pwrplay'],
  },
  'cable-fly-low': {
    assumptions: [
      '站姿雙側獨立滑輪（低位滑輪 85 cm，髖部高度，由下往上斜向夾胸；左右柱距 260 cm），每手各握獨立把手，不套用剛體握把互推。',
      '兩側鋼索左右分量相消，向下與向後分量計入站姿重心平衡；採雙腳併站（實務上建議前後腳分站）。',
      '滑輪比預設 2:1，單側示範配重 18 kg（實感單手 9 kg）與機架尺寸為假設；低位往上斜向夾胸預期較偏上胸（鎖骨部）與前三角肌——此為依肌肉力臂方向的推論，尚無直接比較滑輪高低位的研究。',
    ],
    refs: ['lee2019', 'ackland2008', 'rodriguezridao2020', 'lauver2016', 'signorile2017', 'lifefitness_pwrplay'],
  },
  ohp: {
    assumptions: [
      '站姿每幀調整身體傾角維持重心在腳掌中段；槓經過臉部時自動繞過下巴。',
      '不含肱骨內外旋自由度；斜方肌下束於模型中僅當肩胛下壓肌；示範負重 0.5× 體重為假設。',
    ],
    refs: ['saeterbakken2013'],
    trendNote: '已有站姿／坐姿肩推肌電文獻參考，目前尚未列入自動化趨勢比對項目。',
  },
  row: {
    assumptions: [
      '站姿每幀維持系統重心在腳掌中段；正握時二頭肌屈肘效率調降（0.6× 偏好）由肱肌／肱橈肌多分擔。',
      '不含肱骨內外旋自由度；示範負重 0.7× 體重為假設。',
    ],
    refs: ['fenwick2009', 'saeterbakken2015', 'fischer2025'],
  },
  'row-sup': {
    assumptions: [
      '反握（旋後）時模型提高肱二頭肌偏好係數（1.6×）；其餘站姿平衡假設同正握槓鈴划船。',
      '目前未查得直接比較正握與反握槓鈴划船之期刊全文，反握偏向二頭肌屬解剖推論。',
    ],
    refs: ['kleiber2015', 'fenwick2009'],
    noStudy: true,
    trendNote: '尚無直接比較正握與反握槓鈴划船之同儕審查期刊全文（僅間接參考單關節屈肘握法研究）。',
  },
  'cable-row': {
    assumptions: [
      '坐姿器械（腳踩踏板），不算地面反作用力；鋼索張力沿握把中心指向低滑輪（高 42 cm，典型範圍 35–45 cm）。',
      '雙手透過剛體握把可橫向互推／互拉（上限為單手拉力一半），以最小化肩肘總力矩。',
      '滑輪比 1:1（專用低拉機）或 2:1（多功能滑輪柱），實際手拉力＝配重片重量 ÷ 滑輪比；示範配重 56 kg 為假設。',
    ],
    refs: ['lehman2004', 'vasconcelos2023', 'padovan2025', 'fenwick2009', 'lifefitness_pwrplay', 'lifefitness_pulldown_row'],
  },
  'cable-row-wide': {
    assumptions: [
      '坐姿器械，鋼索指向低滑輪（高 42 cm）；雙手透過寬握剛體橫桿可橫向互推／互拉。',
      '寬握正握時手肘外開角提高至 55° 且二頭肌偏好調降（0.6×）；滑輪比 1:1／2:1 與示範配重 56 kg 假設同窄握划船。',
    ],
    refs: ['vasconcelos2023', 'padovan2025', 'lehman2004', 'lifefitness_pwrplay', 'lifefitness_pulldown_row'],
  },
  uprow: {
    assumptions: [
      '站姿垂手握剛體槓身，假設雙手可橫向互推／互拉使額狀面合力指向肩膀；槓貼近身體前緣不穿透軀幹。',
      '正握二頭肌偏好設為 0.6×；不含肱骨內外旋自由度；示範負重 0.35× 體重為假設。',
    ],
    refs: ['mcallister2013'],
  },
  pulldown: {
    assumptions: [
      '坐姿器械（大腿壓墊固定），不算地面反作用力；鋼索張力沿握把中心指向高滑輪（高 235 cm，對應商用機身 216–244 cm）。',
      '雙手透過剛體握把可橫向互推／互拉（上限為單手拉力一半）；正握二頭肌偏好設為 0.6×。',
      '滑輪比 1:1（專用下拉機）或 2:1（多功能滑輪柱），實際手拉力＝配重片重量 ÷ 滑輪比；示範配重 45 kg 為假設。',
    ],
    refs: ['signorile2002', 'lehman2004', 'lusk2010', 'andersen2014', 'lifefitness_pulldown', 'lifefitness_pulldown_row'],
  },
  'pulldown-sup': {
    assumptions: [
      '反握窄距（1.1× 肩寬）且提高二頭肌偏好係數（1.6×，屬模型調整假設）；高滑輪高 235 cm。',
      '雙手透過剛體握把互推／互拉、滑輪比 1:1／2:1 與示範配重 45 kg 假設同正握滑輪下拉。',
    ],
    refs: ['lusk2010', 'signorile2002', 'lehman2004', 'lifefitness_pulldown', 'lifefitness_pulldown_row'],
  },
  'leg-ext': {
    assumptions: [
      '坐姿單關節器械，僅分析膝伸力矩（髖角與踝角僅影響雙關節股直肌／腓腸肌長度）。',
      '凸輪曲線以「膝屈角度 → 相對力矩」表格內插：人體曲線中段點依 Marginson & Eston (2001) 等之等長測量（0° 與 115° 為外插）；商用微降／漸增凸輪僅端點比例依 Folland & Morris (2008) 8 台機極值（+2.5%～+22.2%、−20.5%～+37.6%），中間點為插值假設；無凸輪選項依小腿水平分量計算。',
      '座椅幾何、墊子偏移與示範配重（1.2× 體重）為假設。',
    ],
    refs: ['escamilla1998', 'folland2008', 'marginson2001', 'knapik1983', 'dacosta2026'],
  },
  'leg-curl': {
    assumptions: [
      '坐姿單關節器械，僅分析膝屈力矩；髖屈曲讓雙關節膕繩肌處於較長肌肉長度。',
      '凸輪曲線以「膝屈角度 → 相對力矩」表格內插：人體曲線趨勢與範圍依 Kulig (1984)、Onishi (2002)、Beyer (2019)，逐點為取中值；示意用上升型凸輪為假設（非實測；Folland & Morris 2008 只量腿伸機）。已知限制：文獻指出曲線依坐姿／俯臥（髖角）而異，目前兩種姿勢共用同一表。',
      '座椅幾何與示範配重（0.45× 體重）為假設。',
    ],
    refs: ['maeo2021', 'mcallister2014', 'kulig1984', 'onishi2002', 'beyer2019'],
  },
  'lying-leg-curl': {
    assumptions: [
      '俯臥單關節器械，僅分析膝屈力矩；髖伸直使雙關節膕繩肌處於較短肌肉長度。',
      '凸輪曲線表（含已知限制：文獻指出曲線依坐姿／俯臥而異，目前兩種姿勢共用同一表）與示範配重（0.45× 體重）同坐姿腿彎舉。',
    ],
    refs: ['maeo2021', 'mcallister2014', 'kulig1984', 'onishi2002', 'beyer2019'],
  },
  pushdown: {
    assumptions: [
      '站姿滑輪動作，含地面反作用力與重心平衡；滑輪向上拉手時自動微增軀幹前傾維持小腿穩定。',
      '雙手透過剛體短槓可橫向互推／互拉；滑輪高 210 cm（對應多功能可調滑輪柱 210–240 cm）。',
      '滑輪比預設 2:1（多功能滑輪柱主流），可切 1:1；實際手拉力＝配重片重量 ÷ 滑輪比；示範配重 38 kg 為假設。',
    ],
    refs: ['maeo2023', 'hussain2020', 'lifefitness_pwrplay'],
    trendNote: '已有三頭長頭長度與下壓疲勞文獻參考，目前尚未列入自動化趨勢比對項目。',
  },
  curl: {
    assumptions: [
      '站姿垂手握剛體槓身，雙手可橫向互推／互拉；每幀維持系統重心在腳掌中段上方。',
      '反握二頭肌偏好設為 1.6×；示範負重 0.35× 體重為假設。',
    ],
    refs: ['oliveira2009', 'kleiber2015', 'marcolin2018'],
  },
  'reverse-curl': {
    assumptions: [
      '正握（旋前）時模型調降二頭肌偏好（0.6×）由肱肌／肱橈肌分擔（註：模型 brach 為肱肌＋肱橈肌合併）。',
      '站姿平衡與示範負重（0.35× 體重）假設同槓鈴彎舉。',
    ],
    refs: ['kleiber2015', 'oliveira2009', 'marcolin2018'],
  },
  shrug: {
    assumptions: [
      '站姿手臂垂直垂於大腿前，雙手透過剛體槓身可橫向互推／互拉，僅動肩胛上提／後收。',
      '示範負重 1.2× 體重為假設。',
    ],
    refs: ['andersen2008', 'pizzari2014'],
    trendNote: '已有聳肩上斜方肌高活化文獻參考，目前尚未列入自動化趨勢比對項目。',
  },
};

// 當參數被使用者自訂、對不上清單變化式時，依 lift 對應預設來源鍵
const LIFT_FALLBACK_ID = {
  squat: 'squat-high',
  deadlift: 'deadlift',
  rdl: 'rdl',
  row: 'row',
  ohp: 'ohp',
  bench: 'bench',
  goodmorning: 'good-morning',
  curl: 'curl',
  shrug: 'shrug',
  uprow: 'uprow',
  hipthrust: 'hip-thrust',
  smith: 'smith-squat',
  legpress: 'leg-press',
  pulldown: 'pulldown',
  cablerow: 'cable-row',
  pushdown: 'pushdown',
  legext: 'leg-ext',
  legcurl: 'leg-curl',
  chestpress: 'chest-press',
  pecdeck: 'pec-deck',
  cablefly: 'cable-fly-mid',
};

export function getSourceInfo(lift, catalogId) {
  const key = (catalogId && SOURCES[catalogId]) ? catalogId : LIFT_FALLBACK_ID[lift];
  const entry = SOURCES[key] || { assumptions: [], refs: [] };
  const trends = trendStatus.byId[key] || [];
  const passCount = trends.filter((t) => t.pass).length;
  let badge;
  if (trends.length > 0) {
    if (passCount === trends.length) badge = { kind: 'ok', text: `文獻比對 ${passCount}/${trends.length} 一致` };
    else if (passCount === 0) badge = { kind: 'fail', text: `文獻比對 0/${trends.length} 不一致` };
    else badge = { kind: 'warn', text: `文獻比對 ${passCount}/${trends.length} 一致` };
  } else if (entry.noStudy) {
    badge = { kind: 'none', text: '尚無直接研究' };
  } else {
    badge = { kind: 'info', text: '已附參考文獻' };
  }
  return {
    key,
    assumptions: [...entry.assumptions, ...COMMON_ASSUMPTIONS],
    refs: entry.refs.map((id) => REFS[id]).filter(Boolean),
    trends,
    trendNote: entry.trendNote || null,
    noStudy: !!entry.noStudy,
    badge,
  };
}
