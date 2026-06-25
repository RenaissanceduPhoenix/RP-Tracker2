const pipelineEtapes = [
    {
        id: 1,
        nom: "Analyse globale de l'historique de la scène",
        temperature: 0.05, // Ultra-factuel et clinique
        prompt: `Analyse avec une rigueur absolue la TOTALITÉ de l'historique textuel fourni de la scène [HISTORIQUE DE LA SCÈNE]. 
Ton objectif est de dresser une cartographie factuelle et chronologique de la situation.
1. Détermine le fil conducteur précis : quel est l'événement déclencheur et comment la confrontation ou l'interaction a progressé de message en message.
2. Évalue l'évolution psychologique de TOUS les personnages en présence : analyse leurs changements de ton, leur réactivité émotionnelle, leurs postures physiques récurrentes et les glissements dans leur comportement du premier au dernier post.
3. Caractérise précisément l'atmosphère générale (froide, hostile, étouffante, mélancolique, tendue) et liste les facteurs environnementaux actifs.
4. Identifie le lieu exact de l'action, sa topographie immédiate, les obstacles spatiaux, la luminosité et la temporalité (aube, nuit, intempéries).
5. Extrais les thématiques majeures abordées (trahison, survie, domination, alliance secrète, deuil).
Rends un résumé clinique, analytique, profond et purement chronologique de la situation globale.
Interdiction absolue d'inventer, d'anticiper la suite, d'extrapoler ou de supposer des événements non écrits. 
Ne produis aucun blabla d'introduction, commence directement par l'analyse factuelle.`
    },
    {
        id: 2,
        nom: "Focalisation sur le point d'ancrage immédiat",
        temperature: 0.05, // Précision chirurgicale et millimétrique
        prompt: `Isole et décortique de manière chirurgicale UNIQUEMENT et exclusivement le tout dernier message écrit par ton interlocuteur dans l'historique. 
Ce post constitue ta seule et unique balise mécanique d'entrée pour la suite du récit.
1. Détermine la position physique exacte de l'interlocuteur à la demi-seconde près à la fin de son action (est-il debout, couché, en suspens, à quelle distance exacte se trouve-t-il de ton personnage ?).
2. Analyse la dynamique de son mouvement : s'agit-il d'une action interrompue, d'une posture figée ou d'une charge cinétique ?
3. Extrais ses toutes dernières paroles prononcées, son intonation exacte (vibrante, brisée, impérieuse) et le sens littéral de sa réplique.
4. Repère et liste ses micro-expressions faciales, le positionnement de son regard, de ses oreilles ou de ses membres à la milliseconde où son post se termine.
Tu dois formuler un rapport de situation spatial et temporel d'une précision millimétrique.
Règle absolue : Ce point d'ancrage est le seul point de départ autorisé pour ta future réaction physique et verbale. 
Tu as l'interdiction formelle de modifier, d'ignorer ou de décaler l'état final décrit par l'interlocuteur.`
    },
    {
        id: 3,
        nom: "Analyse de la fiche du perso concerné",
        temperature: 0.05, // Moteur physique et psychologique rigide
        prompt: `Prends la fiche technique complète et exhaustive du personnage que tu incarnes.
Exécute une analyse de compatibilité physique et sociale avec la situation actuelle.
1. Extrais ses forces physiques brutes (puissance musculaire, agilité, endurance) et confronte-les aux contraintes du décor de l'Étape 1.
2. Identifie ses faiblesses physiques et psychologiques actuelles, ses blessures ouvertes, sa fatigue ou ses limitations sensorielles.
3. Prends en compte son grade au sein du clan (novice, guerrier, lieutenant, guérisseur, chef) et l'autorité ou la soumission mécanique que ce statut implique face à l'interlocuteur.
4. Analyse son tempérament global, ses traits de caractère dominants et ses schémas de pensée automatiques.
Formule une synthèse stricte définissant ce que ce personnage est techniquement et biologiquement capable ou incapable de faire ou de dire dans cette situation précise.
Règle éliminatoire : Tu dois te comporter comme un moteur physique et psychologique rigide. Un novice ne peut pas manifester l'aisance martiale d'un vétéran, et un personnage blessé aux pattes ne peut pas accomplir un bond prodigieux sans en payer le prix narratif.`
    },
    {
        id: 4,
        nom: "Réflexion sur la réaction psychologique",
        temperature: 0.10, // Planification émotionnelle stable, sans action physique
        prompt: `En te basant impérativement sur l'analyse de l'historique global (Étape 1) et du point d'ancrage immédiat (Étape 2), détermine l'impact émotionnel instantané sur ton personnage.
Tu dois analyser ce qu'il ressent à la milliseconde exacte où le message de l'interlocuteur se termine, avant même qu'un muscle ne bouge ou qu'une parole ne soit prononcée.
1. Quelle est l'émotion primaire provoquée (peur panique, colère sourde, sidération, soulagement, méfiance absolue) ?
2. Comment son passif, ses traumatismes et ses relations antérieures avec cet interlocuteur influencent-ils cette réaction psychologique ?
3. Identifie le conflit interne immédiat : ce qu'il ressent au plus profond de lui vs ce qu'il veut laisser paraître.
4. Analyse le traitement cognitif de l'information : comprend-il la portée des paroles de l'autre ou est-il dans l'incompréhension ?
Reste d'une cohérence psychologique inflexible avec l'historique.
Interdiction formelle d'anticiper la suite de la scène, d'engager une action physique ou de formuler un dialogue. Concentre-toi uniquement sur le flux psychologique interne brut.`
    },
    {
        id: 5,
        nom: "Intentions sur les actions physiques",
        temperature: 0.10, // Planification géométrique et morphologique stricte
        prompt: `Planifie et décris avec précision les mouvements physiques macroscopiques que ton personnage va accomplir en réponse directe et immédiate au point d'ancrage (Étape 2).
Cette planification doit être 100% réaliste, biologique et conforme à la morphologie stricte d'un félin sauvage (anatomie, poids, centre de gravité, équilibre).
1. Décris la répartition de ses appuis au sol : quelles pattes se contractent, comment ses griffes s'ancrent dans la terre ou la roche, comment sa colonne vertébrale fléchit ou se détend.
2. Spécifie l'orientation exacte de son corps, de ses épaules, de sa tête et de son axe de vision par rapport à l'interlocuteur.
3. Détermine ses déplacements prévus dans l'espace : recul de sécurité, contournement stratégique, rapprochement intimidant, ou immobilité défensive totale.
4. Justifie l'énergie et la vitesse cinétique appliquées au mouvement (lenteur calculée, explosion de rapidité, tremblement de tension).
Règle géométrique : L'action doit s'insérer parfaitement sans téléportation ni incohérence spatiale par rapport aux positions établies à l'Étape 2. 
Ne rédige pas encore le texte littéraire, formule uniquement des intentions de mouvements claires et séquencées.`
    },
    {
        id: 6,
        nom: "Intentions sur les dialogues",
        temperature: 0.55, // Stratégique, équilibre entre logique et ton sauvage
        prompt: `Détermine de manière hautement stratégique l'intention sémantique et psychologique derrière les prochaines paroles de ton personnage.
Chaque mot prononcé doit être une arme, un bouclier ou un outil de manipulation sociale au sein du clan.
1. Quel est le but exact, unique et précis de sa réplique (intimider l'autre, rassurer un subordonné, fuir une question compromettante, avouer un secret douloureux, poser un ultimatum) ?
2. Choisis le ton exact et les nuances vocales : voix saccadée, murmure feutré, grognement guttural à peine audible, miaulement impérieux.
3. Définis la structure du langage : interdiction formelle d'utiliser des phrases longues, pompeuses, poétiques ou de type humain civilisé. Pense exclusivement 'sauvage, direct, félin et percutant'.
4. Détermine la longueur de la prise de parole : un mot unique, une phrase courte, ou un silence lourd de sens qui coupe la parole.
Formule l'intention sous-jacente et les mots-clés conceptuels qui devront être verbalisés. 
Ne rédige pas de réplique définitive ici, valide uniquement la stratégie de communication.`
    },
    {
        id: 7,
        nom: "Intention sur les pensées",
        temperature: 0.55, // Profondeur psychologique et réflexion intime
        prompt: `Isole avec une étanchéité absolue ce que le personnage va garder secret au plus profond de son esprit.
Il s'agit du flux de conscience intime qui ne doit JAMAIS transparaître dans ses actes physiques ni dans ses paroles à haute voix face à son interlocuteur.
1. Quelle est la vérité crue, le doute toxique ou la peur viscérale qu'il se cache à lui-même ou qu'il refuse catégoriquement de verbaliser dans cette scène précise ?
2. Analyse ses jugements silencieux et secrets sur l'interlocuteur en face de lui (mépris caché, admiration inavouable, désir de vengeance).
3. Formule ses calculs mentaux à court terme : ce qu'il prévoit de faire au message suivant, ses plans de secours si la situation dégénère.
4. Détermine la charge émotionnelle de cette pensée (souffrance contenue, ironie mordante, panique interne refoulée).
Ce monologue intérieur doit apporter une profondeur psychologique abyssale au personnage.
Règle stricte : La pensée doit être en contraste ou en tension directe avec le dialogue planifié à l'Étape 6.`
    },
    {
        id: 8,
        nom: "Première Rédaction brute",
        temperature: 0.40, // Assemblage et logique de structure narrative
        prompt: `Rédige un premier jet brut de la scène de RP en combinant de manière chronologique et logique l'ensemble des réflexions et des intentions validées précédemment.
Tu dois assembler la réaction psychologique (Étape 4), les mouvements physiques (Étape 5), les intentions de dialogues (Étape 6) et le flux des pensées (Étape 7).
1. Respecte une structure narrative linéaire : l'impact émotionnel d'abord, le mouvement corporel qui s'ensuit, puis la parole ou le silence, entrecoupés par les réflexions internes.
2. Ne cherche pas le style parfait, l'élégance littéraire ou les métaphores complexes pour le moment.
3. Concentre-toi à 100% sur la solidité de la structure, l'enchaînement logique des causes et des effets, et le respect absolu de la géométrie de la scène.
4. Assure-toi que chaque intention se traduit par un fait narratif concret dans le texte.
Rends un texte brut, complet, functional et parfaitement structuré, sans sauter aucun élément de réflexion préalable.`
    },
    {
        id: 9,
        nom: "Récupération et décodage des moods",
        temperature: 0.30, // Analyse technique des micro-signaux physiques
        prompt: `Analyse la liste des boutons de 'Moods' actifs et détectés qui te sont fournis pour cette scène.
Chaque mood sélectionné est une contrainte émotionnelle majeure qui doit saturer l'atmosphère et modifier la physiologie du personnage.
1. Pour chaque mood actif, définis une liste de 3 à 5 micro-comportements ou altérations physiques involontaires et réalistes (ex: accélération du rythme cardiaque, crispation invisible des mâchoires, dilatation ou rétractation brutale des pupilles, frémissement de la base de la queue, aplatissement des oreilles, sudation des coussinets).
2. Décode l'impact de ces émotions sur la perception sensorielle du personnage (vision tunnel, hypersensibilité aux bruits, odeurs perçues avec plus d'intensité).
3. Détermine comment ces humeurs influencent la posture passive du personnage (tension musculaire générale, tremblement des membres, rigidité de la nuque).
Traduis des concepts émotionnels abstraits en manifestations physiques concrètes, observables et purement animales. 
Ne produis aucun texte de RP, rends une liste technique de micro-signaux physiques liés aux moods.`
    },
    {
        id: 10,
        nom: "Injection des moods dans le premier jet",
        temperature: 0.55, // Équilibre pour disperser subtilement l'ambiance émotionnelle
        prompt: `Prends la Première Rédaction brute (Étape 8) et injecte de manière subtile, organique et chirurgicale à l'intérieur du récit les micro-comportements et altérations physiques identifiés à l'Étape 9.
L'ambiance émotionnelle ne doit pas être expliquée de manière théorique au lecteur, elle doit transparaître à travers les réactions corporelles inconscientes et viscérales du chat sauvage.
1. Remplace les déclarations abstraites (ex: 'il était en colère') par des descriptions biologiques d'injection de mood (ex: 'le poil de son échine se hérissa, une onde de chaleur sauvage remontant le long de sa colonne vertébrale').
2. Disperse ces micro-signaux au cœur des actions physiques et entre les répliques de dialogue pour hacher le rythme de la scène.
3. Veille à ce que l'intensité des manifestations physiques soit proportionnelle à la situation de crise vécue.
Le texte obtenu doit devenir charnel, biologique et lourdement chargé de la tension nerveuse des émotions actives.`
    },
    {
        id: 11,
        nom: "Seconde Rédaction littéraire",
        temperature: 0.85, // Rédaction créative poussée pour l'immersion sensorielle et lexicale
        prompt: `Réécris l'ensemble du texte obtenu à l'étape précédente en élevant radicalement sa qualité stylistique, poétique et immersive.
Tu dois lui donner une dimension littéraire profonde et une texture organique brute.
1. Améliore la métrique des phrases : alterne judicieusement phrases courtes et percutantes pour les moments de tension, et phrases plus denses pour les descriptions d'états internes.
2. Enrichis et varie le vocabulaire : banni les verbes ternes (faire, dire, voir, aller, être, avoir) et remplace-les par un lexique précis, viscéral, tellurique et sensoriel.
3. Supprime impitoyablement toutes les répétitions de mots, les lourdeurs syntaxiques et les tournures de phrases passives ou impersonnelles.
4. Donne une atmosphère immersive profonde au récit : le texte doit vibrer d'un réalisme animal total, où chaque description évoque la texture du sol, l'odeur du sang, du sanglot ou du vent, et la rudesse de la vie sauvage.
Le récit final doit être captivant, fluide, d'une grande élégance stylistique tout en conservant sa férocité originelle.`
    },
    {
        id: 12,
        nom: "Récupération des dés et contraintes JDR",
        temperature: 0.20, // Strict respect logique des contraintes du verdict du dé
        prompt: `Prends connaissance de la TOTALITÉ des dés JDR lancés pour cette action, de leurs scores numériques exacts et de leurs verdicts mécaniques impératifs (Échec Critique, Échec, Réussite Partielle, Réussite, Réussite Critique).
Tu dois analyser comment cette contrainte aléatoire du système de jeu brise, altère, magnifie ou valide les intentions physiques initiales du personnage (Étape 5).
1. Si le dé indique un Échec ou Échec Critique : détermine la cause physique ou environnementale brutale de ce raté (glissade, faiblesse de la patte blessée, réflexe fulgurant de l'adversaire). L'intention du personnage doit s'effondrer de manière dramatique.
2. Si le dé indique une Réussite Partielle : trouve le compromis exact. L'action réussit mais implique un coût majeur, une blessure légère, une perte d'équilibre ou une concession tactique.
3. Si le dé indique une Réussite ou Réussite Critique : détermine comment l'action s'exécute à la perfection, démontrant la pleine puissance ou la chance insolente du félin.
Formule l'impact mécanique strict des dés sur le scénario physique. 
Interdiction de rédiger le texte final, pose les jalons logiques de la résolution du jet.`
    },
    {
        id: 13,
        nom: "Intégration narrative de l'impact des dés",
        temperature: 0.55, // Transition fluide et narrative de la fatalité du dé
        prompt: `Prends la Seconde Rédaction littéraire (Étape 11) et modifie de force, mais de manière fluide et narrative, l'axe de l'histoire pour y intégrer l'impact des dés analysé à l'Étape 12.
Le destin dicté par les dés doit briser ou valider le fil du récit littéraire initial.
1. Si le jet est un échec, réécris la séquence de mouvement : le personnage entame son action comme prévu à l'Étape 11, mais celle-ci dérape, rate sa cible ou se retourne contre lui de façon logique et immédiate au milieu du paragraphe.
2. Si le jet est une réussite partielle, insère la notion d'effort douloureux ou de sacrifice physique immédiat au moment de l'impact de l'action.
3. Ajuste les réactions psychologiques internes du personnage en temps réel face à la réussite ou au fiasco de son mouvement physique.
Le texte obtenu doit fondre ensemble la fatalité des règles mécaniques du JDR et la beauté de la narration, sans que le lecteur ne ressente de coupure artificielle.`
    },
    {
        id: 14,
        nom: "Troisième Rédaction (Fusion)",
        temperature: 0.75, // Harmonisation fluide et lissage du rythme dramatique
        prompt: `Fusionne, harmonise et réadapte l'ensemble des paragraphes obtenus pour obtenir un texte d'une fluidité absolue et sans couture.
La narration littéraire de haut niveau et les verdicts impitoyables des dés doivent désormais former un seul et unique récit cohérent, haletant et parfaitement unifié.
1. Lisse les transitions entre les moments de pensée intime, les mouvements physiques réussis ou avortés, et les prises de parole.
2. Élimine les ruptures de ton ou les phrases magiques qui tenteraient de justifier artificiellement le résultat d'un dé. Tout doit couler de source.
3. Accentue le rythme dramatique de la scène en veillant à ce que l'enchaînement des actions physiques et des réactions verbales soit viscéral et logique.
Rends un texte d'une coherence narrative parfaite, prêt à subir la phase d'auto-critique et de nettoyage.`
    },
    {
        id: 15,
        nom: "Vérification de la continuité historique",
        temperature: 0.10, // Auto-critique rigoureuse pour traquer les hallucinations spatio-temporelles
        prompt: `Effectue une auto-critique et une correction d'une rigueur absolue concernant la continuité historique et spatiale de la scène.
Compare méthodiquement ton texte actuel avec l'historique global (Étape 1) et le point d'ancrage (Étape 2).
1. Est-ce qu'un élément matériel, topographique, spatial, temporel ou logique se contredit entre ton texte et les posts précédents ? (ex: un objet changé de place, une météo oubliée, une distance incohérente).
2. Vérifie minutieusement qu'aucun personnage absent n'a été inventé ou mentionné par erreur au détour d'une phrase.
3. Supprime impitoyablement toute tournure de phrase évoquant un événement magique, extravagant, surhumain ou hors du réalisme de l'univers des chats sauvages.
Si une incohérence ou une hallucination est détectée, réajuste et modifie le paragraphe concerné pour restaurer la vérité stricte de l'historique.`
    },
    {
        id: 16,
        nom: "Vérification des actions physiques",
        temperature: 0.30, // Relecture technique du poids et du réalisme physique
        prompt: `Effectue une auto-critique technique centrée exclusivement sur les actions physiques de ton personnage.
Vérifie si les mouvements planifiés à l'Étape 5 et altérés par les dés à l'Étape 13 ont été exécutés avec un réalisme corporel irréprochable.
1. Traque et élimine toute mollesse narrative, imprécision spatiale ou omission de mouvement félin.
2. Assure-toi que la sensation de poids, d'impact, de friction avec le sol et de tension musculaire transparaît dans chaque geste décrit.
3. Vérifie que the personnage n'accomplit pas deux actions complexes simultanées qui briseraient le réalisme physique de la scène.
Corrige et dynamise la description des mouvements pour garantir un impact visuel et biologique maximum.`
    },
    {
        id: 17,
        nom: "Vérification des dialogues sauvages",
        temperature: 0.40, // Épuration des structures et polissage du ton de clan sauvage
        prompt: `Effectue une auto-critique stylistique inflexible sur la totalité des répliques de dialogue prononcées par ton personnage.
1. Relis chaque réplique à haute voix virtuellement. Est-ce que le chat parle trop comme un être humain civilisé, moderne ou courtois ? Si oui, détruis ces structures.
2. Est-ce trop bavard, théâtral, explicatif ou pompeux ? Supprime les tirades artificielles.
3. Raccourcis, épure et densifie le langage : ne garde que l'essence brute, sauvage, instinctive et percutante du dialogue de clan. Un chat sauvage utilise des phrases courtes, des métaphores liées à la nature, et ponctue ses paroles de signaux sonores (grognements, feulements).
Remplace le vocabulaire humain résiduel par des structures de communication féline sauvage.`
    },
    {
        id: 18,
        nom: "Vérification du dosage des pensées",
        temperature: 0.55, // Équilibre dramatique et mystère psychologique du flux intérieur
        prompt: `Effectue une auto-critique sur le traitement du monologue intérieur et du flux de pensées intimes de ton personnage.
1. Assure-toi avec certitude que les pensées secrètes apportent une véritable profondeur psychologique, un éclairage nouveau ou une tension dramatique à la scène.
2. Vérifie qu'elles ne se contentent pas de répéter de manière redondante ce qui est déjà parfaitement visible et explicite dans l'action physique ou dans les dialogues.
3. Ajuste leur dosage avec précision : trop de pensées alourdissent le rythme de l'action, pas assez de pensées transforment le personnage en coquille vide.
Trouve l'équilibre parfait pour préserver le mystère du personnage tout en révélant sa complexité interne.`
    },
    {
        id: 19,
        nom: "Vérification de la cohérence du caractère",
        temperature: 0.30, // Alignement strict avec l'historique et la fiche technique
        prompt: `Effectue une auto-critique psychologique comparative entre le comportement du personnage dans ton texte et les traits de caractère fondamentaux gravés dans sa fiche technique (Étape 3).
1. Vérifie qu'il n'y a aucun glissement de personnalité unjustified. Un chat peureux, soumis ou timide ne doit pas agir avec une bravoure insolente ou un ton arrogant sans un élément déclencheur externe d'une puissance extrême écrit dans l'historique.
2. Un chef de clan fier ne doit pas s'humilier ou céder du terrain sans un conflit intérieur violent et visible.
Ajuste les nuances comportementales, les réactions orgueilleuses, les hésitations ou les élans d'agressivité pour que le personnage reste fidèle à lui-même du premier au dernier mot.`
    },
    {
        id: 20,
        nom: "Vérification du respect des peurs",
        temperature: 0.20, // Modélisation stricte des stigmates et blocages traumatiques
        prompt: `Effectue une auto-critique ciblée sur la gestion des traumatismes, des phobies et des peurs viscérales inscrites dans la fiche de ton personnage.
1. Si la situation actuelle, le décor (ex: feu, eau profonde, espace clos) ou les paroles de l'interlocuteur touchent de près ou de loin à l'une des peurs intimes du personnage, le texte doit impérativement en montrer les stigmates narratifs.
2. Traque l'absence de réaction face à un déclencheur traumatique : le texte doit montrer des signes de blocage psychologique, de ralentissement de l'action, de panique interne refoulée ou de stress physique violent (pupilles figées, souffle court).
Ajuste les paragraphes pour honorer la vulnérabilité mécanique et narrative du personnage.`
    },
    {
        id: 21,
        nom: "Vérification des nuances relationnelles",
        temperature: 0.30, // Fidélité envers le passif social et émotionnel commun
        prompt: `Effectue une auto-critique centrée sur l'historique relationnel et le passif social existant entre ton personnage et son interlocuteur.
1. Le ton employé, le choix des mots, la distance physique maintenue et l'intensité des regards sont-ils parfaitement cohérents avec leur passé commun (rivalité féroce, respect fraternel, amour interdit, méfiance politique, passif de trahison) ?
2. Élimine toute familiarité excessive si les personnages se détestent, ou toute froideur artificielle s'ils partagent un lien intime et secret.
Rectifie les nuances comportementales pour que chaque interaction transpire de la vérité historique de leur relation.`
    },
    {
        id: 22,
        nom: "Vérification et application du dictionnaire félin",
        temperature: 0.10, // Élimination éliminatoire de tout geste anthropomorphe
        prompt: `Effectue une auto-critique sémantique et anatomique radicale et éliminatoire.
Tu dois traquer et éradiquer jusqu'au dernier les tics comportementaux ou expressions corporelles anthropomorphes (humaines) qui se seraient glissés dans le texte.
1. Remplace impérativement et sans aucune exception les expressions humaines résiduelles telles que 'il sourit', 'elle haussa les épaules', 'il hocha la tête', 'elle croisa les bras', 'il soupira', 'elle fronça les sourcils' par leurs équivalents anatomiques 100% félins et sauvages.
2. Injecte à la place des expressions corporelles réalistes de félins : mouvements millimétriques des oreilles (rabattues, orientées vers l'arrière, frémissantes), frémissement des moustaches (vibrisses tendues en avant ou plaquées contre les joues), battements, ondulations ou saccades de la queue, allomarquage, retroussement des babines, dévoilement des crocs, plissement des yeux, ou léchage nerveux d'une épaule.
Le texte final doit être purgé de toute humanité gestuelle pour devenir purement animal.`
    },
    {
        id: 23,
        nom: "Génération finale du texte structuré et balisé",
        temperature: 0.95, // Rédaction ultime : créativité maximale, formatage rigide et style haut de gamme
        prompt: `Rédige maintenant le post de RP final complet, parfait, magnifié et définitif au présent de l'indicatif en combinant et en appliquant l'ensemble des analyses, rédactions et auto-critiques validées au cours du pipeline.
Tu dois respecter une continuité géométrique, temporelle et narrative parfaite avec la fin de l'historique global et l'action immédiate.

⚠️ DIRECTIVE GÉOMÉTRIQUE ET SYNTAXIQUE STRICTE (RÈGLE ÉLIMINATOIRE DE PRODUCTION) :
1. Chaque paragraphe ou ligne qui contient un dialogue, une parole dite, un feulement articulé ou une réplique prononcée à haute voix DOIT IMPÉRATIVEMENT commencer dès le tout premier caractère de la ligne par le chevron '> ' suivi d'un espace et d'un tiret cadratin '— ' et se terminer de manière classique.
Exemple strict à appliquer : > — Bonjour, murmura-t-elle en inclinant ses oreilles vers l'avant.
2. Ne mets ABSOLUMENT AUCUN astérisque (* ou **) autour des actions ou des descriptions dans ce post final. Écris les actions, descriptions du décor et expressions passives sous la forme de paragraphes textuels normaux, standards, sans aucun chevron de début de ligne.
3. Il est formellement et strictement interdit d'inclure une introduction, une conclusion, des salutations, des notes techniques, des titres d'étapes, des excuses ou des commentaires hors-RP. 
Renvoie UNIQUEMENT et exclusivement le récit textuel pur, balisé et formaté selon ces deux règles géométriques. Rien d'autre.`
    }
];