# 🦊 JeanScore

Site de avaliação de jogadores do **Cruzeiro Esporte Clube**, feito para você e seus amigos darem notas ao elenco.

## Funcionalidades

- 📋 **Elenco completo** com fotos, posições e notas gerais
- ⚽ **Jogos** (Série A, Copa do Brasil, Libertadores) com placar ao vivo
- ⭐ **Avaliação por jogo** — apenas jogadores que participaram podem ser avaliados
- 🏆 **Rankings** — melhores notas gerais e por jogo
- 👤 **Cadastro com aprovação** — admin aprova novos usuários
- 🔒 **Nota padrão 5** para quem jogou mas não foi avaliado

---

## Como rodar

Abra o `index.html` diretamente no navegador. Funciona offline usando `localStorage`.

Para habilitar o banco de dados em nuvem (Google Sheets), siga as instruções abaixo.

---

## Configurando o Google Sheets

### 1. Criar a planilha
1. Acesse [Google Sheets](https://sheets.google.com) e crie uma planilha nova
2. Pode deixar em branco — o script cria as abas automaticamente

### 2. Criar o Apps Script
1. Na planilha: **Extensões → Apps Script**
2. Apague o código padrão
3. Cole todo o conteúdo do arquivo `google-apps-script/Code.gs`
4. Salve (Ctrl+S)

### 3. Implantar como Web App
1. Clique em **Implantar → Novo implantação**
2. Tipo: **Web App**
3. Execute como: **Eu (jean.honorato.bh@gmail.com)**
4. Quem tem acesso: **Qualquer pessoa**
5. Clique **Implantar** e copie a URL gerada

### 4. Configurar no site
Abra `js/config.js` e substitua:
```js
SHEETS_API_URL: 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID_AQUI/exec',
```
pela URL que você copiou.

---

## Publicando no GitHub Pages

1. Crie um repositório no GitHub (pode ser privado ou público)
2. Faça upload de todos os arquivos desta pasta
3. Vá em **Settings → Pages → Source: GitHub Actions**
4. O deploy será feito automaticamente via workflow

URL final: `https://SEU_USUARIO.github.io/NOME_DO_REPO`

---

## Credenciais padrão do Admin

| Campo | Valor |
|-------|-------|
| Usuário | `Jean` |
| Senha | `jean2025` |
| E-mail | `jean.honorato.bh@gmail.com` |

> ⚠️ Troque a senha após o primeiro acesso entrando com as credenciais acima.

---

## Estrutura de arquivos

```
JeanScore/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js       ← Configurações e chave da API
│   ├── api.js          ← Integração API-Football
│   ├── sheets.js       ← Integração Google Sheets
│   ├── auth.js         ← Autenticação
│   └── app.js          ← Lógica principal
├── google-apps-script/
│   └── Code.gs         ← Backend Google Sheets
├── [fotos dos jogadores].jpg/.png
└── .github/workflows/
    └── deploy.yml      ← Deploy automático GitHub Pages
```

---

## Tecnologias

- HTML/CSS/JS puro (sem frameworks)
- [API-Football](https://www.api-football.com/) para dados do Cruzeiro
- Google Sheets + Apps Script como banco de dados
- GitHub Pages para hospedagem
