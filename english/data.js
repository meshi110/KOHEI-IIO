/* ============================================================
   Ortho English Coach — コンテンツデータ
   FORMAL : 整形外科の国際学会で使う「ガチガチにフォーマル」な英語
   STREET : パブ・コメディ・ラップまで分かる「スラング入り日常会話」
   ============================================================ */

/* ---------- FORMAL ---------- */
const FORMAL = [
{
  id: "rescue", icon: "🆘", title: "聞き取れない・確認する",
  sub: "質疑応答で一番怖いのは「質問が聞き取れない」。ここを型で持っておけば事故らない。",
  items: [
    {en:"I'm sorry, I didn't quite catch the last part of your question. Could you repeat it?", ja:"すみません、質問の最後の部分が聞き取れませんでした。もう一度お願いできますか。", note:"最も安全な定番。didn't quite catch = 完全には聞き取れなかった、という柔らかい言い方。"},
    {en:"Could I ask you to repeat that a little more slowly? The audio is a bit difficult from up here.", ja:"もう少しゆっくり繰り返していただけますか。演台からだと音が少し聞き取りにくくて。", note:"「自分の英語力」ではなく「会場の音響」のせいにする、角の立たない逃げ方。"},
    {en:"Sorry, would you mind speaking a little closer to the microphone?", ja:"すみません、もう少しマイクに近づいてお話しいただけますか。", note:"実際に会場マイクが遠いことは本当に多い。堂々と言ってよい。"},
    {en:"Just to make sure I've understood correctly — you're asking about the length of follow-up, is that right?", ja:"念のため確認させてください。フォローアップ期間についてのご質問という理解でよろしいでしょうか。", note:"最強の武器。聞き返しつつ、答えやすい質問に静かに置き換えられる。"},
    {en:"So, if I understand your question correctly, you'd like to know whether the same effect holds in older patients.", ja:"ご質問を正しく理解できていれば、同じ効果が高齢者でも見られるか、というお尋ねですね。", note:"If I understand your question correctly は考える時間も同時に稼げる。"},
    {en:"Could you clarify what you mean by “functional outcome” in this context?", ja:"この文脈での「機能的アウトカム」が何を指すか、明確にしていただけますか。", note:"言葉の定義を聞き返すのは、学会では知的で誠実な態度と見なされる。"},
    {en:"I want to be sure I answer the right question. Are you asking about the technique, or about the indication?", ja:"的外れな答えをしたくないので確認します。手技についてでしょうか、それとも適応についてでしょうか。", note:"二択に落とすと、相手が短く答えてくれるので一気に楽になる。"},
    {en:"I'm afraid I lost you halfway through. Could you take me back to the beginning of the question?", ja:"途中から分からなくなってしまいました。質問の最初から言い直していただけますか。", note:"lost you = 話を見失った。丁寧かつ正直。"},
    {en:"There seem to be two questions there. May I take the second one first?", ja:"ご質問が二つあるようですね。二つ目からお答えしてもよろしいですか。", note:"長い質問を分割する。答えられる方から先に答えて印象を作る。"},
    {en:"Is your question about our data specifically, or about the technique in general?", ja:"ご質問は我々のデータについてでしょうか、それとも手技一般についてでしょうか。", note:"スコープを確認する。一般論に持ち込めれば答えやすい。"},
    {en:"Sorry, could I ask for the question in one sentence?", ja:"すみません、ご質問を一文でいただけますか。", note:"長広舌の「質問という名の自説」に対して。少し強いので、笑顔と柔らかい声で。"},
    {en:"Thank you — I think I follow. Let me try to answer.", ja:"ありがとうございます、理解できたと思います。お答えします。", note:"聞き返しから答えに移る橋渡し。I think I follow は自然。"}
  ]
},
{
  id: "buytime", icon: "⏳", title: "受け止める・時間を稼ぐ",
  sub: "沈黙が一番まずい。まず口を動かして、脳が追いつく数秒を作る。",
  items: [
    {en:"Thank you for that question.", ja:"ご質問ありがとうございます。", note:"最短の時間稼ぎ。ただしこれ「だけ」を毎回使うと機械的に聞こえるので変化を持つこと。"},
    {en:"That's a very important point, and honestly it's something we debated a great deal within our group.", ja:"非常に重要なご指摘で、実は我々のグループ内でもかなり議論した点です。", note:"5秒稼げて、しかも誠実に響く。最強のクッション。"},
    {en:"That's a great question — and, I have to say, a difficult one.", ja:"素晴らしいご質問です。そして正直に言うと、難しい質問でもあります。", note:"難しさを認めると会場が味方になる。"},
    {en:"Right. Let me answer that in two parts.", ja:"はい。二つに分けてお答えします。", note:"構造を宣言すると、話しながら考える余裕が生まれる。"},
    {en:"Let me think about that for a moment.", ja:"少し考えさせてください。", note:"堂々と言えば、沈黙が「思慮深さ」に変わる。早口の言い訳より強い。"},
    {en:"That goes to the heart of what we were trying to test.", ja:"それはまさに我々が検証しようとしたことの核心です。", note:"質問を持ち上げつつ、自分の土俵に引き戻す。"},
    {en:"I'm glad you asked that, because it's probably the weakest part of the study.", ja:"その質問はありがたいです。おそらく本研究の一番弱い部分ですので。", note:"先に弱点を認めると、その後の反論が驚くほど通りやすくなる。"},
    {en:"Before I answer, may I just clarify one thing about our methods?", ja:"お答えする前に、方法について一点だけ補足してもよろしいですか。", note:"前提を置き直して、答えを有利な位置から始める。"},
    {en:"There are probably three ways to look at this.", ja:"これには、おそらく三つの見方があります。", note:"「三つ」と言えば、一つ目を話す間に二つ目・三つ目を考えられる。"},
    {en:"The short answer is yes. The longer answer is a little more complicated.", ja:"短く答えればイエスです。ただ、もう少し詳しく言うと少し複雑です。", note:"英語の質疑で非常に好まれるリズム。まず結論、次に条件。"}
  ]
},
{
  id: "answer", icon: "🎯", title: "答えの型（結論から言う）",
  sub: "英語の質疑は「結論 → 根拠 → 限定」。日本語の順番のまま話すと迷子になる。",
  items: [
    {en:"The short answer is no, and let me explain why.", ja:"短くお答えするとノーです。理由をご説明します。", note:"最初に立場を決めると、聞き手が安心して聞ける。"},
    {en:"In our series, the mean follow-up was twenty-six months, with a minimum of twenty-four.", ja:"我々のシリーズでは、平均フォローアップは26か月、最短で24か月でした。", note:"数字は聞き取りにくい。ゆっくり、区切って言う。"},
    {en:"We saw the same trend, but it didn't reach statistical significance.", ja:"同じ傾向は見られましたが、統計学的有意には至りませんでした。", note:"「傾向はあったが有意ではない」は最頻出の言い回し。"},
    {en:"Our data suggest, rather than prove, that early mobilisation is beneficial.", ja:"我々のデータは、早期可動が有益であることを証明するというより示唆しています。", note:"suggest rather than prove は、慎重で科学的に聞こえる万能フレーズ。"},
    {en:"That was true in the first twenty cases, but not after we changed the protocol.", ja:"最初の20例では当てはまりましたが、プロトコルを変更してからは違いました。", note:"具体的な区切りを示すと説得力が跳ね上がる。"},
    {en:"To put it in perspective, that's roughly one revision every three years in our unit.", ja:"感覚的に言えば、我々の施設では3年に1回程度の再置換ということになります。", note:"To put it in perspective = 数字を実感に翻訳する。上級者の一言。"},
    {en:"There are two factors at play here: patient selection and surgical technique.", ja:"ここには二つの要因があります。患者選択と手術手技です。", note:"at play = 関与している。フォーマルでも自然。"},
    {en:"I'd say the effect is real, but modest.", ja:"効果は本物だと思いますが、控えめなものです。", note:"I'd say = 個人的見解であることを示す安全弁。"},
    {en:"We looked at that specifically, and we found no difference between the two groups.", ja:"その点は特に検討しましたが、両群間に差はありませんでした。", note:"「ちゃんと見た」と言えることが最大の防御。"},
    {en:"That's exactly what we expected, and that's why we designed the study this way.", ja:"まさにそれが我々の予想で、だからこの研究デザインにしました。", note:"批判を「想定内」に変えるフレーム。"},
    {en:"If I had to give you one number, it would be about fifteen per cent.", ja:"一つの数字で言うなら、およそ15％です。", note:"「一つに絞れ」と言われたときの答え方。潔さが伝わる。"},
    {en:"So, to come back to your question — yes, we would use the same approach again.", ja:"ご質問に戻りますと、はい、我々は再び同じアプローチを選ぶと思います。", note:"長く話した後は必ず質問に戻る。これをやると評価が上がる。"}
  ]
},
{
  id: "limits", icon: "🛡", title: "限界を認める（最強の防御）",
  sub: "海外の学会では「認めない人」より「認めたうえで話を進める人」の方が圧倒的に評価される。",
  items: [
    {en:"You're absolutely right, and that is a limitation of our study.", ja:"おっしゃる通りです。それは本研究の限界です。", note:"言い切ってしまうと、そこで攻撃が止まることが多い。"},
    {en:"That's a fair criticism.", ja:"もっともなご批判です。", note:"三語で場が収まる。fair = 正当な。"},
    {en:"This was a retrospective study, so we can't exclude selection bias.", ja:"後ろ向き研究ですので、選択バイアスは否定できません。", note:"can't exclude = 否定できない。使い勝手が良い。"},
    {en:"Our sample size was not powered to detect a difference of that size.", ja:"我々のサンプルサイズは、その大きさの差を検出する検出力がありませんでした。", note:"not powered to detect は統計批判への標準的な返し。"},
    {en:"I agree — and that's precisely why we're planning a prospective randomised trial.", ja:"同感です。だからこそ前向きランダム化試験を計画しています。", note:"批判を「次の一手」に変換する。最も美しい返し方。"},
    {en:"We are aware of that, and we've tried to address it in the discussion of the manuscript.", ja:"その点は認識しており、論文の考察で扱うようにしています。", note:"「気づいていなかった」と思われないための一言。"},
    {en:"It's a single-centre study, so I'd be cautious about generalising.", ja:"単施設の研究ですので、一般化には慎重であるべきだと思います。", note:"自分から慎重さを表明すると、批判の刃が鈍る。"},
    {en:"The follow-up is admittedly short for an implant study.", ja:"インプラントの研究としては、確かにフォローアップが短いです。", note:"admittedly = 認めるところではあるが。上品な譲歩。"},
    {en:"I wouldn't want to over-interpret this data.", ja:"このデータを過剰に解釈したくはありません。", note:"自分でブレーキを踏んでみせる。信用が上がる。"},
    {en:"That's a limitation we share with most of the published literature on this topic.", ja:"それは、このテーマの既報の多くと共通する限界です。", note:"認めつつ「うちだけではない」と静かに添える。角が立たない。"},
    {en:"We lost eight patients to follow-up, and I can't tell you how they did.", ja:"8例が追跡不能となり、その経過はお答えできません。", note:"正直に言う。ごまかすと必ず次の質問で崩れる。"},
    {en:"Honestly, that's a weakness, and we're working on it.", ja:"正直、それは弱点です。現在改善に取り組んでいます。", note:"Honestly を使うと、その一文だけ急に人間味が出る。"}
  ]
},
{
  id: "pushback", icon: "⚔️", title: "丁寧に反論する",
  sub: "英語の反論は「同意 → 転換 → 根拠」。いきなり No と言わない。",
  items: [
    {en:"I see your point, but I'd respectfully disagree, and here's why.", ja:"ご趣旨は理解しますが、失礼ながら私は異なる意見です。理由を申し上げます。", note:"respectfully disagree は学会での正式な反論宣言。"},
    {en:"That's certainly one interpretation. Our reading of the data is slightly different.", ja:"確かにそれは一つの解釈です。我々のデータの読み方は少し異なります。", note:"相手の解釈を否定せず、横に並べる。非常にスマート。"},
    {en:"With respect, I think that applies to a rather different patient population.", ja:"失礼ながら、それはかなり異なる患者群に当てはまる話だと思います。", note:"With respect は英国で「実はかなり強い反論」の合図でもある。"},
    {en:"I take your point about the sample size, though I'd argue the effect size is large enough to be meaningful.", ja:"サンプルサイズのご指摘は受け止めますが、効果量は意味を持つほど大きいと考えます。", note:"I take your point ... though I'd argue ... は反論の黄金テンプレート。"},
    {en:"I'm not sure the two studies are directly comparable.", ja:"その二つの研究が直接比較可能かどうかは分かりません。", note:"直接否定せずに比較の前提を崩す。使いどころが多い。"},
    {en:"That may be true in general, but it wasn't what we observed here.", ja:"一般論としてはそうかもしれませんが、我々が観察したのは違いました。", note:"一般論 vs 実データ、という構図に持ち込む。"},
    {en:"I'd be careful about drawing that conclusion from registry data alone.", ja:"レジストリデータだけからその結論を導くのは慎重であるべきだと思います。", note:"I'd be careful about ... = 柔らかいが明確な否定。"},
    {en:"If that were the case, we would have expected to see it in the subgroup analysis, and we didn't.", ja:"もしそうであれば、サブグループ解析で見えていたはずですが、見えませんでした。", note:"仮定法で相手の主張を検証する。知的に響く。"},
    {en:"I'd put it slightly differently.", ja:"私なら少し違う言い方をします。", note:"「その言い方は違う」を最大限に上品にした形。"},
    {en:"We can probably agree to disagree on that one.", ja:"その点については、意見の相違ということでよいかもしれません。", note:"平行線になったときの美しい撤収。笑いも起きやすい。"}
  ]
},
{
  id: "escape", icon: "🚪", title: "答えられないときの出口",
  sub: "知らないことを知らないと言えるのは、経験者の余裕として伝わる。",
  items: [
    {en:"I'm afraid I don't have that data with me today, but I'd be happy to send it to you.", ja:"申し訳ありませんが、そのデータは本日手元にありません。後ほどお送りします。", note:"最も安全な出口。実際に名刺交換につながる。"},
    {en:"Honestly, I don't know. That's something we should look at.", ja:"正直、分かりません。今後検討すべき点だと思います。", note:"堂々と言えば全く恥ではない。むしろ好印象。"},
    {en:"That's outside the scope of our study, but my personal impression is that it makes little difference.", ja:"それは本研究の範囲外ですが、個人的な印象では大差ないと思います。", note:"my personal impression = データではないと明示する誠実な逃げ。"},
    {en:"Could we discuss that afterwards? I'd like to give you a proper answer rather than a guess.", ja:"後ほどお話しできますか。当てずっぽうではなく、きちんとお答えしたいので。", note:"時間切れの合図としても機能する。とても紳士的。"},
    {en:"That's a question for our radiologist, I'm afraid.", ja:"それは残念ながら、我々の放射線科医向けの質問ですね。", note:"専門外を素直に示す。会場に笑いが起きることも多い。"},
    {en:"I don't want to speculate, but I can tell you what we did observe.", ja:"憶測は避けたいのですが、我々が実際に観察したことはお話しできます。", note:"speculate を避けると宣言してから、事実に話を戻す。"},
    {en:"We haven't analysed that yet — it's in progress.", ja:"その解析はまだ行っていません。現在進行中です。", note:"シンプルで嘘がない。in progress が効く。"},
    {en:"I'd rather not guess at a number in front of this audience.", ja:"この場で数字を当て推量で申し上げるのは避けたいと思います。", note:"数字を求められて記憶が曖昧なときの逃げ。"},
    {en:"That's a very good question, and I don't think anyone has the answer yet.", ja:"非常に良いご質問ですが、まだ誰も答えを持っていないと思います。", note:"分野全体の未解決問題に格上げしてしまう技。"}
  ]
},
{
  id: "stats", icon: "📊", title: "統計・方法論",
  sub: "統計の突っ込みは必ず来る。専門用語より「言い回し」を先に体に入れる。",
  items: [
    {en:"We used a mixed-effects model to account for repeated measures within the same patient.", ja:"同一患者内の反復測定を考慮するため、混合効果モデルを用いました。", note:"account for = 考慮する。統計の説明で最頻出。"},
    {en:"The difference reached statistical significance, but I'm not convinced it's clinically meaningful.", ja:"差は統計学的有意でしたが、臨床的に意味があるとは確信していません。", note:"この一言が言えると、統計を分かっている人として扱われる。"},
    {en:"The minimal clinically important difference for this score is about ten points, and our difference was twelve.", ja:"このスコアのMCIDは約10点で、我々の差は12点でした。", note:"MCID は minimal clinically important difference。略さず一度言うと親切。"},
    {en:"We performed a post-hoc power analysis, which suggested we were underpowered.", ja:"事後の検出力解析を行い、検出力が不足していたことが示唆されました。", note:"underpowered = 検出力不足。批判の先回りに使える。"},
    {en:"Kaplan–Meier survivorship at ten years was ninety-four per cent, with revision for any reason as the endpoint.", ja:"10年でのKaplan-Meier生存率は94％、エンドポイントは理由を問わない再置換です。", note:"エンドポイントの定義を必ずセットで言うのが作法。"},
    {en:"We adjusted for age, sex, and body mass index in the multivariate analysis.", ja:"多変量解析では、年齢・性別・BMIで補正しました。", note:"adjust for = 補正する。correct for より自然。"},
    {en:"Two independent observers measured the angles, and the intraclass correlation coefficient was 0.91.", ja:"2名の独立した観察者が角度を計測し、級内相関係数は0.91でした。", note:"再現性を聞かれたときの模範解答。"},
    {en:"The p-value was 0.049, so I'd interpret that with a degree of caution.", ja:"p値は0.049でしたので、ある程度慎重に解釈すべきだと思います。", note:"ギリギリの有意差を自分から相対化する。誠実さの演出。"},
    {en:"We used intention-to-treat analysis, and the per-protocol results were very similar.", ja:"ITT解析を用い、per-protocol解析でもほぼ同様の結果でした。", note:"両方見せると批判が来にくい。"},
    {en:"Data were not normally distributed, so we used non-parametric tests throughout.", ja:"データが正規分布しなかったため、一貫してノンパラメトリック検定を用いました。", note:"throughout = 一貫して。方法論の説明で便利。"},
    {en:"We corrected for multiple comparisons using the Bonferroni method.", ja:"多重比較についてはBonferroni法で補正しました。", note:"多重比較の指摘は定番。準備しておくと安心。"},
    {en:"There was no significant difference at baseline between the two groups, apart from BMI.", ja:"ベースラインでは、BMIを除き両群間に有意差はありませんでした。", note:"apart from = 〜を除いて。正直に例外を言うのが上手なやり方。"}
  ]
},
{
  id: "ortho", icon: "🦴", title: "手術・臨床を説明する",
  sub: "整形外科の中身を英語で言い切る練習。単語ではなく文で覚える。",
  items: [
    {en:"We achieved anatomical reduction and stabilised the fracture with a locking plate.", ja:"解剖学的整復を得て、ロッキングプレートで固定しました。", note:"reduction = 整復、fixation/stabilise = 固定。"},
    {en:"The patient was kept non-weight-bearing for six weeks, then progressed to partial weight-bearing.", ja:"6週間免荷とし、その後部分荷重へ進めました。", note:"weight-bearing 周りは英語で言えないと詰まる典型。"},
    {en:"We used a posterior approach in all cases, with the patient in the lateral decubitus position.", ja:"全例で後方アプローチを用い、患者は側臥位としました。", note:"lateral decubitus = 側臥位、supine = 仰臥位、prone = 腹臥位。"},
    {en:"Range of motion improved from ninety degrees preoperatively to one hundred and thirty at final follow-up.", ja:"可動域は術前90度から最終評価時130度へ改善しました。", note:"数字を英語で滑らかに言う練習に最適。"},
    {en:"There was one case of aseptic loosening that required revision at seven years.", ja:"無菌性ルースニングが1例あり、7年で再置換を要しました。", note:"aseptic loosening / septic = 感染性。"},
    {en:"We routinely perform a high tibial osteotomy in younger patients with isolated medial compartment arthritis.", ja:"内側コンパートメントに限局した変形性関節症の若年例には、通例、高位脛骨骨切り術を行います。", note:"osteotomy の発音は「オステ・オトミー」ではなく /ɒsˈtiːɒtəmi/ に近い。"},
    {en:"The union rate was ninety-six per cent, and we had two cases of delayed union.", ja:"骨癒合率は96％で、遷延癒合が2例ありました。", note:"union / non-union / malunion / delayed union は必修セット。"},
    {en:"We removed the hardware at twelve months at the patient's request.", ja:"患者の希望により12か月で抜釘しました。", note:"抜釘は remove the hardware / implant removal。"},
    {en:"The rotator cuff tear was repaired arthroscopically using a double-row technique.", ja:"腱板断裂は鏡視下に二列法で修復しました。", note:"arthroscopically = 鏡視下に。副詞一語で済むのが便利。"},
    {en:"Postoperatively, all patients followed the same rehabilitation protocol supervised by our physiotherapists.", ja:"術後は全例、理学療法士の監督下で同じリハビリテーションプロトコルに従いました。", note:"英国では physiotherapist、米国では physical therapist。"},
    {en:"We defined clinical failure as any reoperation or a drop of more than ten points in the score.", ja:"臨床的失敗を、再手術またはスコアの10点を超える低下と定義しました。", note:"定義を先に言うのは英語プレゼンの基本作法。"},
    {en:"Two patients developed a superficial wound infection, both of which resolved with oral antibiotics.", ja:"2例に表層創感染を認めましたが、いずれも経口抗菌薬で軽快しました。", note:"resolve = 軽快する。get better より医学的。"},
    {en:"Preoperative planning was done on CT with three-dimensional reconstruction.", ja:"術前計画は3次元再構成CTで行いました。", note:"planning は英語プレゼンで意外と多用する。"},
    {en:"In our institution, this procedure is now performed as day surgery.", ja:"当施設では、この手術は現在、日帰り手術として行っています。", note:"英国 day surgery / 米国 outpatient surgery, same-day surgery。"}
  ]
},
{
  id: "prp", icon: "💉", title: "PRP・再生医療の質疑",
  sub: "PRPは方法の詳細を必ず突っ込まれる。数字と定義を英語で即答できるようにする。",
  items: [
    {en:"We used a leukocyte-poor PRP preparation, with a platelet concentration of approximately four times baseline.", ja:"白血球除去型PRPを使用し、血小板濃度はベースラインの約4倍でした。", note:"leukocyte-poor / leukocyte-rich の区別は必ず聞かれる。"},
    {en:"Whole blood was drawn and centrifuged using a closed, commercially available system.", ja:"全血を採取し、市販の閉鎖式システムで遠心分離しました。", note:"centrifuge の発音は「セントリフュージ」/ˈsentrɪfjuːdʒ/。"},
    {en:"Each patient received three injections at two-week intervals.", ja:"各患者は2週間隔で3回の注射を受けました。", note:"at ... intervals = 〜間隔で。"},
    {en:"The injection was performed under ultrasound guidance to ensure intra-articular placement.", ja:"関節内であることを確実にするため、超音波ガイド下に注射しました。", note:"under ultrasound guidance は説得力が大きく上がる一言。"},
    {en:"We report the platelet dose in absolute numbers, because concentration alone can be misleading.", ja:"血小板量を絶対数で報告しています。濃度だけでは誤解を招きうるためです。", note:"最近の議論を踏まえた答え方。分かっている感が出る。"},
    {en:"This was an autologous preparation, so there is no risk of disease transmission.", ja:"自家調製ですので、感染伝播のリスクはありません。", note:"autologous = 自家、allogeneic = 同種。発音注意。"},
    {en:"We can't exclude a placebo effect, since saline injection alone can improve symptoms substantially.", ja:"生理食塩水の注射だけでも症状はかなり改善しうるため、プラセボ効果は否定できません。", note:"PRPの質疑で最頻出の突っ込み。先に自分から言うのが安全。"},
    {en:"The treatment is not covered by public insurance in Japan, so patients pay out of pocket.", ja:"日本では公的保険の適用外であり、患者の自費負担となります。", note:"out of pocket = 自費で。海外の聴衆は必ず費用を聞いてくる。"},
    {en:"We saw the greatest benefit in patients with Kellgren–Lawrence grade two, and much less in grade four.", ja:"最も効果が大きかったのはKellgren-Lawrence分類グレード2で、グレード4では効果は乏しいものでした。", note:"どの層に効いたかを言えると議論が一気に深くなる。"},
    {en:"I'd describe our results as promising but not yet definitive.", ja:"我々の結果は有望ですが、まだ決定的ではないと表現します。", note:"promising but not definitive は再生医療の議論で万能。"}
  ]
},
{
  id: "ask", icon: "🙋", title: "自分が質問する側",
  sub: "フロアからの質問は「褒める → 名乗る → 短く聞く」。これだけで完璧に通る。",
  items: [
    {en:"Thank you for a very nice presentation. Kohei Iio, from Japan. I have two short questions.", ja:"素晴らしいご発表をありがとうございます。日本の飯尾です。短い質問が二つあります。", note:"名乗りは「名前 + 所属/国」。two short questions と言うと座長に嫌がられない。"},
    {en:"Congratulations on an excellent study. Could you clarify how you defined non-union?", ja:"素晴らしい研究をおめでとうございます。偽関節の定義を明確にしていただけますか。", note:"Congratulations on ... は海外の学会では自然で丁寧。"},
    {en:"I'd like to follow up on the previous question, if I may.", ja:"よろしければ、前のご質問に関連して伺いたいのですが。", note:"if I may = よろしければ。丁寧さの決定打。"},
    {en:"Have you looked at whether the results differ by age?", ja:"結果が年齢によって異なるかどうかは検討されましたか。", note:"Have you looked at whether ... は最も使いやすい質問型。"},
    {en:"How do you think your results compare with the registry data?", ja:"ご結果はレジストリデータと比べてどうお考えですか。", note:"compare with = 〜と比較する。"},
    {en:"What would you say is the main take-home message for a general orthopaedic surgeon?", ja:"一般の整形外科医にとっての主な持ち帰りメッセージは何だとお考えですか。", note:"take-home message は学会英語の定番語。"},
    {en:"Just a comment rather than a question, if that's all right.", ja:"質問ではなくコメントですが、よろしいでしょうか。", note:"コメントするときは必ず先に宣言する。作法として重要。"},
    {en:"Sorry, one very quick follow-up.", ja:"すみません、ごく短い追加質問を一つだけ。", note:"quick を入れると座長が許してくれる確率が上がる。"},
    {en:"Do you use this technique routinely now, or is it still selective?", ja:"この手技は現在ルーチンで用いていますか、それともまだ症例を選んでいますか。", note:"実臨床に踏み込む質問。演者が答えやすく、議論も広がる。"},
    {en:"Thank you, that answers my question.", ja:"ありがとうございます、それで疑問が解けました。", note:"きちんと締める。これを言う人は品よく見える。"}
  ]
},
{
  id: "chair", icon: "🎙", title: "冒頭・締め・座長として",
  sub: "発表の枠を作る言葉。ここが決まると、その後の英語が下手でも印象は良い。",
  items: [
    {en:"Thank you, Mr Chairman. Thank you for the opportunity to present our work.", ja:"座長ありがとうございます。発表の機会をいただき感謝します。", note:"女性座長なら Madam Chair / Chairperson。近年は Chair だけも普通。"},
    {en:"I have no conflicts of interest to declare in relation to this presentation.", ja:"本発表に関して開示すべき利益相反はありません。", note:"COIスライドで必ず読む一文。丸暗記推奨。"},
    {en:"The aim of this study was to determine whether early mobilisation improves functional outcome.", ja:"本研究の目的は、早期可動が機能的予後を改善するかを明らかにすることでした。", note:"The aim of this study was to ... は最重要テンプレート。"},
    {en:"I'll structure my talk in three parts: background, methods, and results.", ja:"本日は背景・方法・結果の三部構成でお話しします。", note:"構成の予告は英語圏の聴衆にとても効く。"},
    {en:"In conclusion, our results suggest that this technique is safe and reproducible.", ja:"結論として、本手技は安全かつ再現性があることが示唆されました。", note:"In conclusion で締めると、聴衆が拍手の準備に入る。"},
    {en:"Thank you for your attention. I'd be happy to take any questions.", ja:"ご清聴ありがとうございました。ご質問をお受けします。", note:"最後の一文。ここを堂々と言うと質疑の雰囲気が変わる。"},
    {en:"I'm afraid we're running short of time, so could I ask for one final question?", ja:"時間が押しておりますので、最後の質問を一つだけお願いできますか。", note:"座長役のときに使う。running short of time は上品。"},
    {en:"May I ask you to keep your questions brief, as we're behind schedule.", ja:"進行が遅れておりますので、質問は簡潔にお願いいたします。", note:"座長としての標準的な仕切り。"},
    {en:"Perhaps you could continue that discussion during the coffee break.", ja:"その議論はコーヒーブレイクの間に続けていただければと思います。", note:"白熱しすぎた議論を止める、最も角の立たない方法。"},
    {en:"Let's thank the speaker once again.", ja:"改めて演者に拍手をお願いします。", note:"締めの一言。座長を頼まれたとき用に持っておく。"}
  ]
},
{
  id: "pron", icon: "🔊", title: "発音の落とし穴",
  sub: "日本人整形外科医が高確率で通じない語。アクセント位置だけ直せば劇的に通じる。",
  items: [
    {en:"osteotomy", ja:"骨切り術", note:"os-tee-OT-o-my。第3音節にアクセント。「オステオトミー」と平坦に言うと通じない。"},
    {en:"arthroplasty", ja:"人工関節置換術", note:"AR-thro-plas-ty。頭にアクセント。plasty を「プラスティ」と強く言わない。"},
    {en:"arthroscopy", ja:"関節鏡検査", note:"ar-THROS-co-py。第2音節。arthroscopic は ar-thro-SCOP-ic とアクセントが移動する。"},
    {en:"cadaver", ja:"献体・遺体", note:"kuh-DAV-er。「カダバー」ではなく「カダーヴァ」。"},
    {en:"epiphysis", ja:"骨端", note:"e-PIF-y-sis。第2音節。metaphysis は me-TAF-y-sis。"},
    {en:"aetiology / etiology", ja:"病因", note:"ee-tee-OL-o-gy。英国綴りは ae-。"},
    {en:"sequela / sequelae", ja:"後遺症", note:"si-KWEL-a / si-KWEL-ee。複数形の発音がよく事故る。"},
    {en:"platelet", ja:"血小板", note:"PLATE-let。「プラトレット」ではなく「プレイトレット」。PRPの説明で必須。"},
    {en:"hyaluronic acid", ja:"ヒアルロン酸", note:"hy-a-lu-RON-ic。「ヒアルロン」ではなく「ハイアルロニック」。"},
    {en:"allogeneic / autologous", ja:"同種 / 自家", note:"al-o-je-NE-ic / aw-TOL-o-gus。autologous は第2音節。"},
    {en:"anterior / posterior", ja:"前方 / 後方", note:"an-TEER-ee-er / pos-TEER-ee-er。第2音節を長く。"},
    {en:"varus / valgus", ja:"内反 / 外反", note:"VAIR-us / VAL-gus。日本語の「バルス・バルグス」だと区別されない。"},
    {en:"femoral / humeral", ja:"大腿の / 上腕の", note:"FEM-er-al / HYOO-mer-al。どちらも頭にアクセント。"},
    {en:"protocol", ja:"プロトコル", note:"PRO-to-col。英国は「プロウトコル」、米国は「プラウトコル」。"},
    {en:"data", ja:"データ", note:"英国 DAY-ta が主流、米国は DAY-ta / DA-ta 両方。The data suggest（複数扱い）が学術的に無難。"},
    {en:"significant", ja:"有意な", note:"sig-NIF-i-cant。第2音節。学会で最も回数を言う単語なので、ここだけは磨く価値がある。"}
  ]
},
{
  id: "social", icon: "☕️", title: "学会の社交・立ち話",
  sub: "実は本番。休憩時間の30秒の雑談が、共同研究や招待講演につながる。",
  items: [
    {en:"Are you presenting this week?", ja:"今週は発表されるんですか。", note:"最も自然な会話の入り口。相手が話したいことを聞ける。"},
    {en:"I really enjoyed your talk this morning — especially the part about the learning curve.", ja:"今朝のご発表、大変興味深く拝聴しました。特にラーニングカーブのお話が。", note:"具体的な部分を挙げると、社交辞令ではないと伝わる。"},
    {en:"Do you mind if I join you?", ja:"ご一緒してもよろしいですか。", note:"コーヒーやランチの席で。断られることはまずない。"},
    {en:"What's your take on the new guidelines?", ja:"新しいガイドラインについてはどうお考えですか。", note:"take on = 〜についての見解。ややカジュアルだが立ち話に最適。"},
    {en:"How do you handle these cases in your unit?", ja:"貴施設ではこういう症例をどう扱われていますか。", note:"in your unit は英国的。米国なら in your practice。"},
    {en:"We should stay in touch — here's my card.", ja:"ぜひ連絡を取り合いましょう。私の名刺です。", note:"stay in touch は別れ際の定番。"},
    {en:"Would you be interested in collaborating on a multi-centre study?", ja:"多施設共同研究にご興味はありますか。", note:"言われるより言う方が主導権を取れる。"},
    {en:"Is this your first time in Japan? Let me know if you'd like some recommendations.", ja:"日本は初めてですか。おすすめが必要でしたら言ってください。", note:"日本開催の学会でホスト側に立つときの黄金句。"},
    {en:"Sorry, I'm terrible with names — could you remind me?", ja:"すみません、名前を覚えるのが苦手で。もう一度伺えますか。", note:"正直に言った方が好かれる。誰もが使う言い訳。"},
    {en:"It was really good to meet you. Enjoy the rest of the meeting.", ja:"お会いできて良かったです。残りの学会もお楽しみください。", note:"締めの型。これを言えると会話の終わり方が上手い人になる。"}
  ]
}
];

/* ---------- STREET ---------- */
const STREET = [
{
  id: "update", icon: "🕰", title: "2002 → 2026 アップデート",
  sub: "イギリスにいた頃から言葉は入れ替わった。まずは「死語」と「新語」の棚卸しから。",
  items: [
    {en:"no cap", ja:"マジで、嘘じゃない", note:"cap = 嘘。“No cap, that was the best curry I've had.” 現代スラングの基礎語。", reg:"casual"},
    {en:"lowkey / highkey", ja:"ちょっと / 正直めっちゃ", note:"“Lowkey nervous about my talk.”＝ちょっと緊張してる。“Highkey”は逆に堂々と強調。", reg:"casual"},
    {en:"it hits different", ja:"格が違う、沁みる", note:"“Coffee after a night shift hits different.” 感覚的な良さを表す万能句。", reg:"casual"},
    {en:"mid", ja:"微妙、平凡", note:"褒めていない。“The food was mid.”＝可もなく不可もなく。かなり刺さる評価。", reg:"casual"},
    {en:"cooked", ja:"終わってる、詰んだ", note:"“I forgot my slides — I'm cooked.” 2020年代後半で最頻出の一語。", reg:"casual"},
    {en:"he ate that / she ate", ja:"完璧にやってのけた", note:"元はドラァグ文化。“Her keynote? She ate.” 皮肉ではなく最大級の称賛。", reg:"casual"},
    {en:"understood the assignment", ja:"求められてることを完全に理解してた", note:"期待に完璧に応えた人へ。“The chair understood the assignment.”", reg:"casual"},
    {en:"it's giving ...", ja:"〜っぽい雰囲気出てる", note:"“It's giving 2009 PowerPoint.” 名詞を後ろに置くだけ。皮肉に強い。", reg:"casual"},
    {en:"rizz", ja:"人を惹きつける力、口説きの才", note:"charisma の短縮。“He's got rizz.” 中年が使うと少し面白がられる（それも狙える）。", reg:"casual"},
    {en:"delulu", ja:"妄想がすぎる", note:"delusional の短縮。“Thinking I'd finish the paper in one night was delulu.”", reg:"casual"},
    {en:"sus", ja:"怪しい", note:"suspicious の短縮。ゲーム由来だが完全に一般語化した。", reg:"casual"},
    {en:"based", ja:"信念を曲げてなくて良い", note:"元ネットスラング。“Refusing to use that implant? Based.” 政治的文脈では注意。", reg:"casual"},
    {en:"touch grass", ja:"ちょっと外に出ろ、現実に戻れ", note:"ネットに浸りすぎた人への軽い煽り。友人間限定。", reg:"casual"},
    {en:"living rent free in my head", ja:"頭から離れない", note:"“That question from the floor is living rent free in my head.” 皮肉に最適。", reg:"casual"},
    {en:"That's phat / da bomb / off the hook", ja:"（死語）最高", note:"2000年前後の語。今使うと「お父さんが頑張ってる」感が出る。逆に狙って言えばウケる。", reg:"dead"},
    {en:"on fleek / YOLO / swag", ja:"（死語）完璧 / 人生一度きり / イケてる", note:"2012–2015年で燃え尽きた語。真顔で使うと本気で古い。", reg:"dead"},
    {en:"Talk to the hand.", ja:"（死語）聞く耳持たん", note:"90年代。今言うと確実に笑いが取れる、という価値だけが残っている。", reg:"dead"},
    {en:"W / L (a big W, took the L)", ja:"勝ち / 負け", note:"“Getting that grant was a big W.” “I took the L on that question.” 会話でも普通に使う。", reg:"casual"}
  ]
},
{
  id: "uk", icon: "🇬🇧", title: "UKパブ・スラング",
  sub: "イギリスで一年暮らした耳を叩き起こす。これは今も現役の語彙。",
  items: [
    {en:"You alright? / Y'alright mate?", ja:"よお、調子どう？", note:"質問ではなく挨拶。答えは “Yeah, you?” で十分。真面目に体調を語ると変な顔をされる。", reg:"safe"},
    {en:"Cheers.", ja:"ありがとう／じゃあね／乾杯", note:"英国で最も出番の多い一語。会計時も別れ際も全部これでいける。", reg:"safe"},
    {en:"knackered / shattered", ja:"へとへと", note:"“I'm absolutely knackered after that clinic.” knackered はごく普通の口語。", reg:"casual"},
    {en:"gutted", ja:"がっかり、ショック", note:"“I was gutted when the abstract got rejected.” 感情の強さがちょうどよく伝わる。", reg:"casual"},
    {en:"chuffed", ja:"すごく嬉しい", note:"“Chuffed to bits.”＝めちゃくちゃ嬉しい。英国人らしい控えめな喜び方。", reg:"safe"},
    {en:"sound", ja:"いいね／いい奴", note:"“He's sound.”＝あいつはいい奴。北部でよく聞く。", reg:"casual"},
    {en:"sorted", ja:"片付いた、解決", note:"“Flights are sorted.”＝フライトは手配済み。使い勝手が非常に良い。", reg:"safe"},
    {en:"dodgy", ja:"怪しい、いまいち", note:"“A dodgy knee.”＝調子の悪い膝。医学的にも日常的にも使える。", reg:"casual"},
    {en:"cheeky (a cheeky pint / a cheeky Nando's)", ja:"ちょっとした、こっそりの", note:"“A cheeky pint before the gala dinner.” 英国ユーモアの核。悪いことを軽くやる感じ。", reg:"casual"},
    {en:"taking the piss / taking the mick", ja:"からかう／ふざけてる", note:"“Are you taking the piss?”＝ふざけてんの？ piss は下品寄り、mick は安全版。", reg:"rude"},
    {en:"faff / faff about", ja:"無駄に手間取る", note:"“Too much faff.”＝手間がかかりすぎ。学会の受付でよく心の中で使う。", reg:"casual"},
    {en:"can't be arsed", ja:"やる気が起きない", note:"“I can't be arsed to go to the last session.” かなりくだけた語。上司には言わない。", reg:"rude"},
    {en:"bloke / lad / mate", ja:"男／若い男／相棒", note:"mate は呼びかけの万能語。ただし女性に mate はやや稀（地域による）。", reg:"casual"},
    {en:"proper (proper good, proper knackered)", ja:"マジで、本当に", note:"副詞として very の代わり。“Proper good talk, that.” 語順の倒置も英国的。", reg:"casual"},
    {en:"Do you fancy a pint?", ja:"一杯どう？", note:"fancy = 〜したい気分。英国で最も重要な社交フレーズかもしれない。", reg:"safe"},
    {en:"It's my round.", ja:"次は俺のおごりだ", note:"パブのラウンド制。参加した以上は必ず一回は自分の round を買うのが礼儀。", reg:"safe"},
    {en:"minging / grim", ja:"ひどい、汚い", note:"“The weather's grim.” grim は天気・体調・気分すべてに使える便利語。", reg:"casual"},
    {en:"innit", ja:"〜だよね", note:"isn't it の短縮だが万能タグ化。ロンドン近郊で頻出。多用すると若者ぶって聞こえる。", reg:"casual"},
    {en:"bare (bare jokes, bare people)", ja:"めっちゃ、たくさん", note:"ロンドンの若者言葉。40代が使うと相当な冒険。だからこそ狙って言えば面白い。", reg:"casual"},
    {en:"Bollocks. / That's bollocks.", ja:"くだらん、でたらめだ", note:"かなり強い。学会場では絶対に使わない。パブで仲間内なら普通。", reg:"very-rude"}
  ]
},
{
  id: "understate", icon: "🎩", title: "英国式ホンネ翻訳",
  sub: "英国人が言うことと、意味していること。これを知らないと学会で穏やかに殺される。",
  items: [
    {en:"With all due respect...", ja:"（本音）あなたは間違っている", note:"直後に必ず全否定が来る。学会で言われたら身構えるべき合図。", reg:"safe"},
    {en:"That's an interesting approach.", ja:"（本音）正気か？", note:"interesting は英国では褒め言葉ではないことが多い。文脈と声のトーンで判断。", reg:"safe"},
    {en:"I'd suggest you might want to consider...", ja:"（本音）やり直せ", note:"何重にも柔らかくした命令。might want to は指示の婉曲形。", reg:"safe"},
    {en:"Quite good.", ja:"（本音）まあまあ、悪くはない", note:"米国では「かなり良い」だが英国では評価を下げる。ここが最大の罠。", reg:"safe"},
    {en:"Not bad.", ja:"（本音）かなり良い", note:"quite good と逆。英国人の褒め言葉はだいたい控えめな否定形で来る。", reg:"safe"},
    {en:"I'm sure it's my fault, but...", ja:"（本音）あなたの説明が悪い", note:"完全な責任転嫁を丁寧語で包んだ形。腹を立てず、笑顔で説明し直すのが正解。", reg:"safe"},
    {en:"That's a very brave decision.", ja:"（本音）無謀だ、やめとけ", note:"brave は警告。手術方針の議論で言われたら再考の合図。", reg:"safe"},
    {en:"I almost agree.", ja:"（本音）同意しない", note:"almost がついたら同意していない。", reg:"safe"},
    {en:"I'll bear it in mind.", ja:"（本音）忘れる", note:"“I'll keep it in mind” も同様。本気なら具体的な次の行動が続く。", reg:"safe"},
    {en:"You must come for dinner sometime.", ja:"（本音）社交辞令", note:"日付が出てこなければ社交辞令。日付が出たら本気。", reg:"safe"},
    {en:"Perhaps we could look at that again.", ja:"（本音）全部書き直せ", note:"共著者からのコメントで来たら、赤字が大量に来る前触れ。", reg:"safe"},
    {en:"It's fine.", ja:"（本音）よくない", note:"声が下がる “It's fine.” は危険信号。日本語の「大丈夫です」と同じ多義性。", reg:"safe"}
  ]
},
{
  id: "us", icon: "🇺🇸", title: "US日常・雑談",
  sub: "AAOS など米国の学会で、廊下やバーで実際に飛び交う言い回し。",
  items: [
    {en:"What's up? / 'Sup?", ja:"よお", note:"答えは “Not much, you?” が定型。近況を長々語らない。", reg:"casual"},
    {en:"How's it going?", ja:"調子どう？", note:"“Good, how about you?” で返す。これも挨拶であって質問ではない。", reg:"safe"},
    {en:"My bad.", ja:"ごめん、俺のミス", note:"軽い謝罪。学会場でも同僚相手なら普通。正式な謝罪には使わない。", reg:"casual"},
    {en:"No worries. / You're good.", ja:"気にしないで", note:"“You're good.” は米国で急速に一般化した返し。", reg:"casual"},
    {en:"For sure. / Absolutely.", ja:"もちろん", note:"相槌として非常に便利。Yes の単調さを避けられる。", reg:"safe"},
    {en:"Shoot me an email / Hit me up.", ja:"メールして／連絡して", note:"名刺交換のあとに。Hit me up はよりくだけた言い方。", reg:"casual"},
    {en:"Let's grab a beer.", ja:"軽く飲もう", note:"grab = 気軽に取る。grab lunch, grab coffee も同様。", reg:"casual"},
    {en:"I'm beat. / I'm wiped.", ja:"疲れ果てた", note:"英国の knackered に相当。", reg:"casual"},
    {en:"That tracks.", ja:"まあ、納得だね", note:"筋が通っている、の意。近年よく聞く。", reg:"casual"},
    {en:"Say less. / Bet.", ja:"了解、話は分かった", note:"Bet = OK、いいね。かなり若い言い方。使う相手を選ぶ。", reg:"casual"},
    {en:"I'm down.", ja:"乗った、賛成", note:"“Dinner at eight?” “I'm down.” 英国の I'm up for it に相当。", reg:"casual"},
    {en:"It is what it is.", ja:"まあ、しょうがない", note:"諦めの万能句。人生の大半はこれで処理できる。", reg:"safe"},
    {en:"Long story short, ...", ja:"かいつまんで言うと", note:"話をまとめる合図。学会の雑談でも使える。", reg:"safe"},
    {en:"I'll let you go.", ja:"じゃあこの辺で", note:"会話を切り上げる魔法の言葉。相手を気遣う形で終われる。", reg:"safe"},
    {en:"Good talking to you.", ja:"話せて良かったです", note:"立ち話の締め。It was good talking to you. の短縮。", reg:"safe"},
    {en:"Where are you based?", ja:"どちらにお住まい／ご所属で？", note:"Where are you from? より丁寧で自然。国際学会での定番。", reg:"safe"}
  ]
},
{
  id: "sarcasm", icon: "🎭", title: "皮肉・コメディの型",
  sub: "英語のユーモアは「型」がある。型を知れば、笑いを取る側に回れる。",
  items: [
    {en:"Oh, brilliant.", ja:"（皮肉）はい最高ですね", note:"トーンを下げて平坦に言うと皮肉になる。英国の基本装備。", reg:"casual"},
    {en:"Well, that went well.", ja:"（皮肉）大成功でしたね", note:"明らかに失敗した直後に言う。質疑で撃沈した後の自嘲に最適。", reg:"casual"},
    {en:"Yeah, no. / No, yeah.", ja:"いや、違う。／うん、そう。", note:"最後の語が本音。“Yeah, no” は否定、“No, yeah” は肯定。会話で本当に使う。", reg:"casual"},
    {en:"I'm fine. This is fine.", ja:"（皮肉）大丈夫、問題ない（全然大丈夫でない）", note:"炎の中で座る犬のミーム由来。完全に一般語化した。", reg:"casual"},
    {en:"It's not ideal.", ja:"（英国式）控えめに言って最悪", note:"英国の過小表現。手術が大変だったときにこう言うと通が笑う。", reg:"safe"},
    {en:"That's a bold strategy.", ja:"（皮肉）大胆な作戦ですね", note:"映画由来の定型。相手の判断に疑問を呈するときの上品な嫌味。", reg:"casual"},
    {en:"Nothing says “evidence-based” like a single case report.", ja:"症例報告一本ほど「エビデンス」を感じさせるものはないね", note:"Nothing says X like Y は皮肉の万能テンプレート。自分の分野ネタで作れる。", reg:"casual"},
    {en:"I'm not saying I'm bad at golf, but the ball is safer if I aim elsewhere.", ja:"ゴルフが下手とは言わないが、狙わない方がボールは安全だ", note:"英国式自虐の型。“I'm not saying X, but Y.” 使い回しが効く。", reg:"safe"},
    {en:"Why is nobody talking about the coffee at this venue?", ja:"この会場のコーヒーの話、なんで誰もしないの？", note:"“Why is nobody talking about X?” は現代的な振り。軽い共感を取れる。", reg:"casual"},
    {en:"To be fair, ...", ja:"まあ公平に言えば", note:"英国の会話で異常に多用される前置き。自分でツッコミを和らげるときに。", reg:"safe"},
    {en:"He's not wrong.", ja:"まあ、間違ってはいない", note:"渋々の同意。二重否定で温度を下げる英語らしい表現。", reg:"safe"},
    {en:"the audacity", ja:"その厚かましさよ", note:"“The audacity of asking that question at 6pm.” 単独で嘆く形で使う。", reg:"casual"},
    {en:"I can't even.", ja:"もう無理、言葉にならない", note:"文を途中で止めるのがポイント。やや古いが定着した。", reg:"casual"},
    {en:"That's above my pay grade.", ja:"それは私の権限外です（＝知らんがな）", note:"職場ユーモアの定番。答えたくない質問への軽い逃げにも使える。", reg:"safe"}
  ]
},
{
  id: "rap", icon: "🎤", title: "ラップ／ヒップホップ語彙",
  sub: "歌詞が聞き取れない原因の8割は単語ではなく語彙のレイヤー違い。ここを埋める。",
  items: [
    {en:"bars", ja:"リリック、韻の詰まった歌詞", note:"“He's got bars.”＝リリックが上手い。小節そのものの意味も持つ。", reg:"casual"},
    {en:"flow", ja:"リズムへの乗せ方", note:"声・譜割り・間の取り方の総称。“The flow is crazy.”", reg:"casual"},
    {en:"spit / spit bars", ja:"ラップする", note:"“He spits fast.” rap という動詞より現場的。", reg:"casual"},
    {en:"banger", ja:"最高の曲", note:"“That track's a banger.” 曲以外にも使えるようになってきた。", reg:"casual"},
    {en:"beef", ja:"対立、確執", note:"“They've got beef.” ラッパー同士の抗争の定番語。", reg:"casual"},
    {en:"diss (diss track)", ja:"けなす、攻撃する曲", note:"disrespect の短縮。日常会話でも “Don't diss my playlist.”", reg:"casual"},
    {en:"clout", ja:"影響力、知名度", note:"“clout chasing”＝有名になるための売名行為。批判語として使われる。", reg:"casual"},
    {en:"drip / fit", ja:"着こなし、服装", note:"“The drip is immaculate.” fit は outfit の短縮。", reg:"casual"},
    {en:"whip", ja:"車", note:"“Nice whip.” 学会のレンタカーを褒めるときに使うと確実にウケる。", reg:"casual"},
    {en:"bands / racks / guap", ja:"大金", note:"bands は札束の帯、racks は1000ドル単位。金の話は語彙が異常に多い。", reg:"casual"},
    {en:"opps", ja:"敵、対立勢力", note:"opposition の短縮。文脈が物騒なことが多いので使用は慎重に。", reg:"rude"},
    {en:"real talk", ja:"マジな話", note:"“Real talk, that was the best presentation today.” 会話でも自然に使える。", reg:"casual"},
    {en:"on god / ong", ja:"神に誓って、マジで", note:"強調。no cap とほぼ同義で使われる。", reg:"casual"},
    {en:"keep it a buck", ja:"正直に言う", note:"a buck = 100（＝100％）。“Let me keep it a buck with you.”", reg:"casual"},
    {en:"switch up", ja:"態度を変える、裏切る", note:"“He switched up on me.” 人間関係の話で頻出。", reg:"casual"},
    {en:"snake", ja:"裏切り者", note:"“Don't be a snake.” 共同研究の話をパブでするとき、冗談で使える。", reg:"casual"},
    {en:"the come up", ja:"のし上がる過程", note:"“It's been a long come up.” 苦労して上がってきた物語。", reg:"casual"},
    {en:"grind / hustle", ja:"努力、稼ぎ、必死の日々", note:"“The grind never stops.” 医者の当直生活にそのまま使える。", reg:"safe"},
    {en:"throwing shade", ja:"遠回しに人をけなす", note:"“That review was throwing shade.” 査読コメントの描写に最適。", reg:"casual"},
    {en:"ride or die", ja:"何があっても味方の存在", note:"“My scrub nurse is my ride or die.” 愛情表現として使える。", reg:"casual"}
  ]
},
{
  id: "aave", icon: "🧠", title: "AAVEの文法と、使うときの作法",
  sub: "ラップとコメディの理解に不可欠な文法。ただし「使う」のと「分かる」のは別問題。",
  items: [
    {en:"habitual “be” — He be working late.", ja:"いつも／習慣的に〜している", note:"He is working late（今）と He be working late（いつも）は別の意味。AAVEの最重要文法。", reg:"safe"},
    {en:"finna — I'm finna leave.", ja:"今から〜するところ", note:"fixing to の短縮。going to より直近の未来。", reg:"casual"},
    {en:"tryna — I'm tryna get to the session.", ja:"〜しようとしている", note:"trying to の短縮。カジュアルな話し言葉では白人・黒人問わず広く使われる。", reg:"casual"},
    {en:"boutta — He boutta drop a new album.", ja:"まさに〜しようとしている", note:"about to の短縮。歌詞で頻出。", reg:"casual"},
    {en:"double negative — I ain't got no time.", ja:"時間なんてない（強調の二重否定）", note:"文法ミスではなく、この方言では強調として正しい形。", reg:"casual"},
    {en:"ain't", ja:"〜ではない", note:"am/is/are/have not すべてを代用。フォーマルでは絶対に使わない。", reg:"casual"},
    {en:"dropping the copula — She smart.", ja:"be動詞の省略", note:"She is smart の is が落ちる。AAVEの規則的な特徴。", reg:"safe"},
    {en:"y'all / y'all's", ja:"あなたたち", note:"南部由来だが全米に拡散。実は英語の二人称複数の穴を埋める合理的な語。", reg:"safe"},
    {en:"（作法）Understand it, quote it, but don't perform it.", ja:"理解し、引用はしても、演じない", note:"AAVEは黒人コミュニティの言語文化。外部の人間が全開で真似ると滑るか失礼になる。聞き取れることが目的。", reg:"safe"},
    {en:"（作法）Quoting a lyric is fine. Adopting an accent is not.", ja:"歌詞の引用はよいが、アクセントの模倣はよくない", note:"“As Kendrick says, ...” のように引用の枠に入れるのが安全で、しかも知的に見える。", reg:"safe"}
  ]
},
{
  id: "netslang", icon: "📱", title: "ネット・SNS発の日常語",
  sub: "今の英語圏の会話は、ネット由来の語彙抜きには成立しない。",
  items: [
    {en:"IYKYK (if you know, you know)", ja:"分かる人には分かる", note:"内輪ネタの合図。会話でも “iykyk” と口に出して言う人がいる。", reg:"casual"},
    {en:"ratio'd", ja:"（返信の方が多くて）論破された、袋叩き", note:"SNS由来。“He got ratio'd.” 会話でも比喩的に使う。", reg:"casual"},
    {en:"main character energy", ja:"主人公感", note:"“She walked in with main character energy.” 褒めにも皮肉にもなる。", reg:"casual"},
    {en:"the ick", ja:"一気に冷める感じ", note:"“He corrected the waiter's pronunciation — instant ick.”", reg:"casual"},
    {en:"gaslighting", ja:"相手の認識を否定して混乱させる行為", note:"元は心理学用語だが日常語化。ただし乱用への批判もある。", reg:"safe"},
    {en:"red flag / green flag", ja:"危険信号／良い兆候", note:"人物評価の定番。“Answering emails at 3am is a red flag.”", reg:"safe"},
    {en:"doomscrolling", ja:"暗いニュースを延々読み続けること", note:"“I was doomscrolling until 2am.” 完全に定着した語。", reg:"safe"},
    {en:"ghosting", ja:"急に連絡を絶つこと", note:"恋愛以外にも使う。“That reviewer ghosted us for four months.”", reg:"safe"},
    {en:"cringe (adj.)", ja:"痛い、見ていられない", note:"名詞から形容詞化。“That slide transition was cringe.”", reg:"casual"},
    {en:"vibe / vibe check / immaculate vibes", ja:"雰囲気／雰囲気の確認", note:"“The vibes were off.”＝空気がおかしかった。使用頻度が非常に高い。", reg:"casual"},
    {en:"canon event", ja:"避けられない通過儀礼", note:"“Bombing your first international talk is a canon event.” 慰めに使える。", reg:"casual"},
    {en:"npc", ja:"没個性的な人／機械的な受け答え", note:"ゲーム由来。かなり失礼になりうるので相手を選ぶ。", reg:"rude"},
    {en:"glazing", ja:"過剰にヨイショすること", note:"“Stop glazing the keynote speaker.” 近年急速に広まった。", reg:"casual"},
    {en:"aura / lost all his aura", ja:"格、オーラ（を失った）", note:"“He dropped the mic and lost all his aura.” 若者語の最新層。", reg:"casual"}
  ]
},
{
  id: "afterhours", icon: "🍺", title: "学会後のパブ",
  sub: "フォーマルとストリートの橋。ここが一番実戦で使う場面かもしれない。",
  items: [
    {en:"Right, who's for a pint?", ja:"さて、飲みに行く人は？", note:"Right, で始めるのが英国的な仕切りの合図。", reg:"safe"},
    {en:"That Q&A was brutal, mate.", ja:"あの質疑、えげつなかったな。", note:"brutal は「容赦ない」。共感を作る最短ルート。", reg:"casual"},
    {en:"I completely blanked on that last question.", ja:"最後の質問で完全に頭が真っ白になった。", note:"blank on = ど忘れする。誰もが経験しているので必ず盛り上がる。", reg:"safe"},
    {en:"The chair was having none of it.", ja:"座長がまったく取り合わなかった。", note:"have none of it = 断固として受け付けない。英国的な言い回し。", reg:"casual"},
    {en:"He asked that question purely so people would hear his own name.", ja:"あいつ、自分の名前を聞かせたいためだけに質問してたな。", note:"学会あるある。共感で確実に笑いが取れる。", reg:"casual"},
    {en:"I was bricking it before I went on.", ja:"登壇前、めちゃくちゃビビってた。", note:"bricking it = 英国の口語で「怖くて仕方ない」。かなりくだけている。", reg:"rude"},
    {en:"Fair play to her, that was a solid talk.", ja:"彼女は大したもんだ、いい発表だった。", note:"Fair play to ... = 素直に敬意を表す英国表現。", reg:"safe"},
    {en:"Same again?", ja:"もう一杯同じの？", note:"パブでの最小限の会話。これだけで一晩持つ。", reg:"safe"},
    {en:"I'm going to call it a night — early session tomorrow.", ja:"今夜はこれで失礼するよ、朝のセッションが早いんだ。", note:"call it a night = お開きにする。最も自然な帰り方。", reg:"safe"},
    {en:"Get in!", ja:"よっしゃ！", note:"英国の歓声。抄録が通ったとき、ゴールが決まったときに。", reg:"casual"},
    {en:"Don't get me started.", ja:"その話をさせたら止まらないぞ", note:"愚痴の前振り。会話が一気にくだけた方向に進む。", reg:"safe"},
    {en:"Long day. I'm running on coffee and adrenaline.", ja:"長い一日だった。コーヒーとアドレナリンだけで動いてる。", note:"共感を呼ぶ自己描写。医療者同士なら鉄板。", reg:"safe"}
  ]
},
{
  id: "register", icon: "🚦", title: "TPOと地雷ワード",
  sub: "「知っているが言わない」を判断するための基準。ここを間違うと一発で信用を失う。",
  items: [
    {en:"bollocks / bloody hell / piss off", ja:"（英）くだらん／なんてこった／失せろ", note:"パブでは日常、学会場では厳禁。bloody は英国では中程度、米国ではほぼ無害に響く。", reg:"very-rude"},
    {en:"the f-word as an intensifier", ja:"強調のFワード", note:"英豪では友人間で驚くほど普通。だが非母語話者が使うと不自然に響きやすい。まず聞き取れることを目標に。", reg:"very-rude"},
    {en:"“You guys” to a mixed group", ja:"混成グループへの「みんな」", note:"米国では普通だが、性別中立を重んじる場では “folks” “everyone” が無難。", reg:"safe"},
    {en:"Calling someone “crazy” or “insane”", ja:"人を「クレイジー」と呼ぶ", note:"物事には使えるが、人に使うと精神疾患への配慮を欠くと取られることがある。医療者は特に注意。", reg:"rude"},
    {en:"“Oriental” for people", ja:"人に対する Oriental", note:"完全に不可。Asian を使う。物（絨毯など）には残るが、人には決して使わない。", reg:"very-rude"},
    {en:"Commenting on someone's weight or age", ja:"体重や年齢への言及", note:"日本の雑談では普通でも、英語圏では踏み込みすぎ。学会の雑談では絶対に避ける。", reg:"rude"},
    {en:"“Sorry, my English is poor.” を連発する", ja:"英語ができないと繰り返す", note:"一度なら謙虚、三度言うと聞き手が疲れる。“Bear with me”（少しお付き合いを）に置き換える。", reg:"safe"},
    {en:"Bear with me.", ja:"少しお付き合いください", note:"言い直すとき・言葉を探すときの上品な一言。謝罪の連発より遥かに良い。", reg:"safe"},
    {en:"Let me rephrase that.", ja:"言い直させてください", note:"失敗を「推敲」に見せる魔法。母語話者も常に使う。", reg:"safe"},
    {en:"What's the word I'm looking for...", ja:"えーっと、なんて言うんだったかな", note:"沈黙より遥かに自然。相手が単語を補ってくれることも多い。", reg:"safe"}
  ]
}
];

/* ---------- DIALOGUES ---------- */
const DIALOGUES = {
formal: [
  {
    id:"d-f1", title:"サンプルサイズを突かれる", sub:"最も多い攻撃パターン。認めて、効果量に話を移す。",
    turns:[
      {who:"Q", en:"Thank you for the presentation. With only thirty-two patients, aren't you rather underpowered to make that claim?", ja:"発表ありがとう。しかし32例では、その主張をするには検出力が足りないのでは？"},
      {who:"A", en:"That's a fair criticism, and you're right that we're underpowered for the secondary endpoints.", ja:"もっともなご批判です。副次評価項目については検出力不足というのはその通りです。", note:"まず全面的に認める。ここで粘ると印象が悪い。"},
      {who:"A", en:"For the primary outcome, though, the effect size was large enough that we reached significance with this number.", ja:"ただし主要評価項目については、効果量が大きく、この症例数でも有意差に達しました。", note:"though を後置するのが英語らしいリズム。"},
      {who:"A", en:"I'd say the honest conclusion is that this is hypothesis-generating rather than definitive.", ja:"正直な結論としては、これは決定的というより仮説生成的なものだと考えます。", note:"hypothesis-generating は魔法の言葉。批判を受け止めつつ研究の価値を守る。"},
      {who:"Q", en:"Fair enough. Are you planning a larger series?", ja:"なるほど。より大きなシリーズは計画していますか。"},
      {who:"A", en:"We are — a multi-centre study is starting next year, and we'd be delighted if your unit wanted to take part.", ja:"はい、来年から多施設研究を始めます。貴施設にご参加いただけたら大変嬉しいです。", note:"攻撃を共同研究の誘いに変換する。最高の着地。"}
    ]
  },
  {
    id:"d-f2", title:"手技の選択を疑われる", sub:"「なぜそのアプローチ？」に、データと現実の両方で答える。",
    turns:[
      {who:"Q", en:"Why did you choose a posterior approach rather than the direct anterior, which most centres are moving towards?", ja:"多くの施設が直接前方アプローチに移行している中で、なぜ後方アプローチを選んだのですか。"},
      {who:"A", en:"That's a question we get a lot, and there are two reasons.", ja:"よく受ける質問です。理由は二つあります。", note:"「よく聞かれる」と言うと、想定内であることが伝わる。"},
      {who:"A", en:"First, the published dislocation rates in our hands are comparable, provided the soft tissue repair is done properly.", ja:"第一に、軟部組織の修復を適切に行えば、我々の手では脱臼率は同等です。", note:"in our hands = 自分たちの経験では。学会で頻出。"},
      {who:"A", en:"Second, and more practically, it's the approach our whole team is trained in, and consistency matters more than fashion.", ja:"第二に、より現実的な話として、これはチーム全体が習熟したアプローチであり、流行より一貫性が重要だと考えています。", note:"more than fashion は軽い皮肉。会場が笑うことも多い。"},
      {who:"Q", en:"So you wouldn't change?", ja:"つまり変えるつもりはないと？"},
      {who:"A", en:"Not on current evidence, no. If a well-designed trial showed a clear difference, I'd change tomorrow.", ja:"現在のエビデンスでは変えません。よくデザインされた試験で明確な差が示されれば、明日にでも変えます。", note:"科学的な柔軟さを示して締める。非常に印象が良い。"}
    ]
  },
  {
    id:"d-f3", title:"PRPのプロトコルを詰められる", sub:"数字を即答できるかどうかで、信頼が決まる。",
    turns:[
      {who:"Q", en:"Could you tell us the platelet concentration, and whether your preparation was leukocyte-rich or leukocyte-poor?", ja:"血小板濃度と、白血球が多い調製か少ない調製かを教えてください。"},
      {who:"A", en:"Certainly. It was leukocyte-poor, and the platelet concentration was approximately four times baseline.", ja:"はい。白血球除去型で、血小板濃度はベースラインの約4倍でした。", note:"Certainly. と即答できると、それだけで信頼される。"},
      {who:"A", en:"We also report the absolute platelet dose, because concentration alone depends on the patient's baseline count.", ja:"血小板の絶対量も報告しています。濃度だけでは患者のベースライン値に左右されるためです。", note:"一歩先の情報を自分から出すと、批判が止まる。"},
      {who:"Q", en:"And how do you exclude a placebo effect? Saline alone improves symptoms in these patients.", ja:"プラセボ効果はどう除外しますか。これらの患者では生理食塩水だけでも症状が改善します。"},
      {who:"A", en:"We can't, and I won't pretend otherwise. This was a single-arm study.", ja:"除外できません。そうでないふりをするつもりもありません。これは単群研究です。", note:"I won't pretend otherwise は強く誠実に響く。"},
      {who:"A", en:"What I would say is that the effect persisted at twelve months, which is longer than most placebo responses reported in the literature.", ja:"ただ申し上げられるのは、効果が12か月持続したことで、これは文献で報告される多くのプラセボ反応より長いということです。", note:"What I would say is ... で反撃に転じる型。"}
    ]
  }
],
street: [
  {
    id:"d-s1", title:"学会後のパブ", sub:"初対面の外国人医師と、一杯目から打ち解けるまで。",
    turns:[
      {who:"B", en:"Alright? You were in the trauma session, weren't you?", ja:"やあ。外傷のセッションにいたよね？"},
      {who:"You", en:"Yeah, I was. I gave the talk on locking plates — the one right before lunch, so nobody was listening.", ja:"ええ。ロッキングプレートの発表をしました。昼食直前だったので誰も聞いてませんでしたけど。", note:"自虐で入るのが英国流。一気に距離が縮まる。"},
      {who:"B", en:"Ha! Graveyard slot. Been there. What are you drinking?", ja:"はは、墓場の枠だな。俺も経験ある。何飲む？"},
      {who:"You", en:"A pint of whatever's local. And it's my round after this one.", ja:"地元のビールを一杯。次は僕がおごりますね。", note:"my round を自分から言うのが最重要マナー。"},
      {who:"B", en:"Sound. So how long are you over for?", ja:"いいね。どのくらい滞在するの？"},
      {who:"You", en:"Just the week. Honestly, my English is a bit rusty — I lived in the UK about twenty years ago and I've barely used it since.", ja:"今週だけです。正直、英語が錆びついていて。20年ほど前にイギリスに住んでいたきり、ほとんど使ってないんです。", note:"rusty は自然で好かれる自己申告。一度だけ言うのがコツ。"},
      {who:"B", en:"Mate, you're doing better than most. Where were you?", ja:"いや、大抵の人より上手いよ。どこにいたの？"},
      {who:"You", en:"Up north for a year. Rained the entire time, but the people were sound.", ja:"北の方に一年。ずっと雨でしたけど、人はみんな良かったです。", note:"sound を使えると「分かってる人」認定される。"}
    ]
  },
  {
    id:"d-s2", title:"コーヒーブレイクの雑談", sub:"3分で終わる立ち話を、気持ちよく成立させる。",
    turns:[
      {who:"B", en:"Is this seat taken?", ja:"ここ、空いてますか？"},
      {who:"You", en:"All yours. The coffee here is... an experience.", ja:"どうぞ。ここのコーヒーは…なかなかの体験ですよ。", note:"間を置いて婉曲に貶す。英語ユーモアの基本形。"},
      {who:"B", en:"Ha, that bad? Where are you based?", ja:"はは、そんなにひどい？ どちらのご所属で？"},
      {who:"You", en:"Japan — a sports and regenerative medicine clinic. Mostly knees. You?", ja:"日本です。スポーツと再生医療のクリニックで、主に膝を診ています。そちらは？", note:"短く答えて必ず投げ返す。会話が続く最大のコツ。"},
      {who:"B", en:"Sheffield. Mostly trauma. Regenerative stuff — is that PRP, or are you doing cells as well?", ja:"シェフィールドです。主に外傷を。再生医療というのはPRP？ それとも細胞治療も？"},
      {who:"You", en:"PRP mainly. It's a bit of a Wild West out there, to be honest — everyone uses a different protocol.", ja:"主にPRPです。正直、あの分野はかなり無法地帯で、みんなプロトコルがバラバラなんです。", note:"a bit of a Wild West は英語圏の医師によく刺さる表現。"},
      {who:"B", en:"Tell me about it. Right, I'd better get to the next session. Good to meet you.", ja:"まったくだね。さて、次のセッションに行かないと。会えて良かったです。", note:"Tell me about it. = ほんとそれ（皮肉ではなく強い共感）。"},
      {who:"You", en:"You too. Enjoy the rest of the meeting.", ja:"こちらこそ。残りの学会も楽しんでください。"}
    ]
  },
  {
    id:"d-s3", title:"音楽とコメディの話になる", sub:"仕事以外の話ができると、一気に「人」として覚えられる。",
    turns:[
      {who:"B", en:"So what do you actually listen to? Please don't say classical.", ja:"で、実際何を聴いてるの？ クラシックとか言わないでね。"},
      {who:"You", en:"Honestly? A lot of hip-hop. I understand maybe sixty per cent of the lyrics, and I'm working on the other forty.", ja:"正直に言うと、ヒップホップをよく聴きます。歌詞は6割くらいしか分かってなくて、残り4割は勉強中です。", note:"正直な数字を出すと面白くなる。ユーモアの基本は具体性。"},
      {who:"B", en:"Respect. Who's on rotation?", ja:"それはすごい。誰をよく聴くの？"},
      {who:"You", en:"Kendrick mostly. The wordplay is unreal — half of it goes straight over my head, but you can feel it.", ja:"だいたいケンドリックです。言葉遊びが尋常じゃなくて、半分は頭を素通りするんですが、伝わってはくるんです。", note:"goes over my head = 理解できない。自然な言い回し。"},
      {who:"B", en:"That's the point though, innit. You get more every time.", ja:"でもそこがいいんだよな。聴くたびに分かることが増える。"},
      {who:"You", en:"Exactly. Same with British comedy. It took me a year to work out that “not bad” meant “brilliant”.", ja:"まさに。英国のコメディも同じです。“not bad”が「最高」の意味だと理解するのに一年かかりました。", note:"文化ネタの自虐。英国人が最も喜ぶ話題の一つ。"},
      {who:"B", en:"Ha! And “quite good” means “rubbish”. You've cracked the code.", ja:"はは！ で、“quite good”は「イマイチ」だ。もう暗号を解読したな。"}
    ]
  }
]
};

/* ---------- SIMULATOR: 想定質問バンク ---------- */
const SIM = {
formal: [
  {q:"Your follow-up is only two years. Isn't that too short to draw any conclusions about implant survival?",
   qja:"フォローアップが2年しかありません。インプラント生存について結論を出すには短すぎませんか。",
   a:"You're absolutely right, and that's a limitation. Two years tells us about early failure — infection, loosening, technical problems — but nothing about long-term survivorship. What I can say is that our early failure rate is comparable to the registry data, and we're continuing to follow this cohort.",
   keys:["You're absolutely right, and that's a limitation","What I can say is","comparable to the registry data"]},
  {q:"With only thirty-two patients, are you not underpowered?",
   qja:"32例では検出力不足ではありませんか。",
   a:"For the secondary endpoints, yes, we are underpowered. For the primary outcome, the effect size was large enough that we reached significance. I'd describe the study as hypothesis-generating rather than definitive.",
   keys:["underpowered","effect size","hypothesis-generating rather than definitive"]},
  {q:"This is a retrospective study. How do you exclude selection bias?",
   qja:"後ろ向き研究です。選択バイアスをどう除外しますか。",
   a:"We can't exclude it, and I won't pretend otherwise. What we did was apply strict inclusion criteria defined before the analysis, and we adjusted for the baseline differences we could measure. Unmeasured confounding remains a real possibility.",
   keys:["We can't exclude it","adjusted for the baseline differences","Unmeasured confounding"]},
  {q:"Your control group looks quite different at baseline. Did you adjust for that?",
   qja:"対照群のベースラインがかなり異なるようです。補正しましたか。",
   a:"Yes. Age, sex, BMI and preoperative score were all entered into the multivariate model. The only variable that remained significant was the preoperative score, and the treatment effect persisted after adjustment.",
   keys:["entered into the multivariate model","the treatment effect persisted after adjustment"]},
  {q:"How is this different from the paper published by Smith and colleagues last year?",
   qja:"昨年のSmithらの論文と何が違うのですか。",
   a:"That's a fair question. Their study looked at a younger population and used a different fixation device. The direction of the results is the same, which I find reassuring, but the magnitude in our series is smaller.",
   keys:["That's a fair question","The direction of the results is the same","the magnitude in our series is smaller"]},
  {q:"You mentioned a significant improvement — significant statistically, or clinically?",
   qja:"「有意な改善」とおっしゃいましたが、統計学的にですか、臨床的にですか。",
   a:"Both, I would argue. The p-value was 0.003, and the mean difference of twelve points exceeds the minimal clinically important difference of ten for this score. But I take the point that the two are often confused.",
   keys:["Both, I would argue","exceeds the minimal clinically important difference","I take the point"]},
  {q:"Could the improvement simply reflect the natural history of the disease?",
   qja:"改善は単に疾患の自然経過を反映しているだけではありませんか。",
   a:"That's the key question, and without a control arm I can't rule it out. What argues against it is the timing — the improvement occurred within four weeks of injection, whereas natural improvement in this condition is usually much slower.",
   keys:["without a control arm I can't rule it out","What argues against it is the timing"]},
  {q:"In your PRP protocol, what was the platelet concentration, and was it leukocyte-rich or leukocyte-poor?",
   qja:"PRPのプロトコルで、血小板濃度は？ 白血球は多いですか少ないですか。",
   a:"Leukocyte-poor, prepared with a closed commercial system, at approximately four times baseline concentration. We also report the absolute platelet dose, because concentration alone depends on the patient's baseline platelet count.",
   keys:["Leukocyte-poor","four times baseline","absolute platelet dose"]},
  {q:"How did you handle patients who were lost to follow-up?",
   qja:"追跡不能となった患者はどう扱いましたか。",
   a:"Eight patients were lost to follow-up. We did a worst-case sensitivity analysis, assuming all of them had failed, and the difference between groups was reduced but remained significant.",
   keys:["worst-case sensitivity analysis","reduced but remained significant"]},
  {q:"Do you think your results are generalisable to a Western population?",
   qja:"この結果は欧米の集団にも一般化できるとお考えですか。",
   a:"With caution. Our patients had a lower mean BMI and a higher proportion of varus deformity than most European series, and both of those could affect the outcome. I'd be interested to see the same protocol tested in your population.",
   keys:["With caution","could affect the outcome","I'd be interested to see"]},
  {q:"What would you do differently if you started this study today?",
   qja:"今この研究を始めるとしたら、何を変えますか。",
   a:"Three things: a control arm, a longer follow-up, and a patient-reported outcome measure chosen with our patients rather than for them. The last one is the change I feel most strongly about.",
   keys:["Three things","chosen with our patients rather than for them"]},
  {q:"Did you have any complications you haven't shown us?",
   qja:"お示しになっていない合併症はありませんか。",
   a:"Nothing hidden, no. There were two superficial wound infections, both resolved with oral antibiotics, and one patient with transient nerve palsy that recovered by three months. They're in the manuscript.",
   keys:["Nothing hidden, no","both resolved with","They're in the manuscript"]},
  {q:"Is this technique reproducible outside a specialist centre?",
   qja:"専門施設以外でも再現可能な手技ですか。",
   a:"Honestly, I don't know yet. All of these cases were done by two surgeons who had already passed the learning curve. That's exactly why the multi-centre study matters — it will test reproducibility directly.",
   keys:["Honestly, I don't know yet","passed the learning curve","test reproducibility directly"]},
  {q:"Who funded this study, and do you have any conflicts of interest?",
   qja:"この研究の資金源は？ 利益相反はありますか。",
   a:"The study was funded internally by our institution. Neither I nor any co-author has received payment from the manufacturer, and none of us holds any related patent.",
   keys:["funded internally by our institution","has received payment from the manufacturer"]},
  {q:"Sorry — could you go back to slide seven? I'd like to see that table again.",
   qja:"すみません、スライド7に戻していただけますか。あの表をもう一度見たいのですが。",
   a:"Of course. Give me a moment. Here it is — the left-hand column is the treatment group. Which row would you like me to talk through?",
   keys:["Of course. Give me a moment","Which row would you like me to talk through"]},
  {q:"Your p-value is 0.049. Would you really change your practice on the basis of that?",
   qja:"p値が0.049です。本当にそれで診療を変えますか。",
   a:"No, not on that alone. A p-value that close to the threshold tells me the study is consistent with a real effect, not that it proves one. I'd want to see it replicated before changing practice.",
   keys:["No, not on that alone","consistent with a real effect, not that it proves one","replicated before changing practice"]},
  {q:"Have you considered that the effect might be driven by a small subgroup?",
   qja:"効果が小さなサブグループによって生じている可能性は考えましたか。",
   a:"We did look at that. When we stratified by Kellgren–Lawrence grade, the benefit was concentrated in grades two and three. So yes — the average effect probably overstates the benefit for advanced disease.",
   keys:["We did look at that","the benefit was concentrated in","overstates the benefit"]},
  {q:"What is the cost of this treatment, and who pays for it in Japan?",
   qja:"この治療の費用は？ 日本では誰が負担しますか。",
   a:"It isn't covered by public insurance, so patients pay out of pocket — roughly the equivalent of six hundred pounds per course of three injections. That obviously affects who ends up being treated, and it's a limitation of any cohort like ours.",
   keys:["isn't covered by public insurance","pay out of pocket","affects who ends up being treated"]},
  {q:"Why did you choose that particular outcome measure?",
   qja:"なぜその評価尺度を選んだのですか。",
   a:"Mainly for comparability — it's the measure used by the two largest published series, so our numbers can be read alongside theirs. If I were designing it now, I'd add a measure of return to sport.",
   keys:["Mainly for comparability","read alongside theirs","If I were designing it now"]},
  {q:"What's the next step for your group?",
   qja:"次のステップは何ですか。",
   a:"A prospective, randomised, controlled study with a saline control arm, starting next year across four centres. And if anyone here is interested in joining, please do come and find me afterwards.",
   keys:["prospective, randomised, controlled study","come and find me afterwards"]}
],
street: [
  {q:"So what do you actually do, then?", qja:"で、実際どんな仕事してるの？",
   a:"I'm an orthopaedic surgeon — knees mostly, and a fair bit of regenerative stuff. Basically I inject people's own blood back into their joints and they pay me for it.",
   keys:["knees mostly","Basically I","and they pay me for it"]},
  {q:"First time over here?", qja:"こっちに来るのは初めて？",
   a:"Not quite — I lived here for a year back in 2001. Everything's changed except the weather.",
   keys:["Not quite","Everything's changed except the weather"]},
  {q:"How did your talk go?", qja:"発表どうだった？",
   a:"Yeah, not bad, actually. I completely blanked on one question, but I don't think anyone noticed. Or they were too polite to say.",
   keys:["not bad, actually","completely blanked","too polite to say"]},
  {q:"Fancy another one?", qja:"もう一杯どう？",
   a:"Go on then, but it's my round. Same again?",
   keys:["Go on then","it's my round","Same again"]},
  {q:"What did you make of the keynote?", qja:"基調講演どう思った？",
   a:"Honestly? Bit of a slog. Great data, but forty-two slides is a lot to get through before lunch.",
   keys:["Bit of a slog","is a lot to get through"]},
  {q:"You must be knackered with the jet lag.", qja:"時差ボケで疲れてるでしょう。",
   a:"Absolutely shattered. I've been running on coffee and adrenaline since Tuesday.",
   keys:["Absolutely shattered","running on coffee and adrenaline"]},
  {q:"What are you listening to these days?", qja:"最近何を聴いてるの？",
   a:"Mostly hip-hop, which surprises people. I catch maybe sixty per cent of the lyrics — the wordplay goes straight over my head, but you can feel it.",
   keys:["which surprises people","goes straight over my head","you can feel it"]},
  {q:"Do you get much time off?", qja:"休みは取れてる？",
   a:"Define time off. But yeah, the grind's real — it is what it is.",
   keys:["Define time off","the grind's real","it is what it is"]},
  {q:"Right, I'd better head off. Good to meet you.", qja:"じゃあそろそろ行くね。会えてよかった。",
   a:"You too, mate. Let's stay in touch — shoot me an email and we'll sort something out.",
   keys:["You too, mate","stay in touch","sort something out"]},
  {q:"Is Japanese food over here any good?", qja:"こっちの日本食は美味しい？",
   a:"It's... an interesting interpretation. Let's leave it there.",
   keys:["an interesting interpretation","Let's leave it there"]}
]
};

const MODES = {
  formal: { key:"formal", label:"学会フォーマル", icon:"🎓", sections:FORMAL, dialogues:DIALOGUES.formal, sim:SIM.formal,
            tagline:"国際学会の質疑応答で、崩れない英語" },
  street: { key:"street", label:"ストリート／日常", icon:"🎤", sections:STREET, dialogues:DIALOGUES.street, sim:SIM.street,
            tagline:"パブ・コメディ・ラップまで届く英語" }
};

const REG_LABEL = {
  "safe":     {t:"どこでもOK", c:"#22c55e"},
  "casual":   {t:"仲間内OK",   c:"#f59e0b"},
  "rude":     {t:"かなり砕けた", c:"#f97316"},
  "very-rude":{t:"学会では禁止", c:"#ef4444"},
  "dead":     {t:"死語",       c:"#64748b"}
};
