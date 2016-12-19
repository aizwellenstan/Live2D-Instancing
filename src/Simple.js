'use strict';
// オフスクリーン用のテクスチャ
var ftexture;
// カウンタの宣言
let count = 0;

const CANVAS_SIZE = 512;        // canvasサイズ
const CANVAS_ID = 'glcanvas';   // canvasID
// Live2D モデル設定
const MODEL_DEF = {
    "type":"Live2D Model Setting",
    "name":"haru",
    "model":"assets/haru/haru.moc",
    "textures":[
        "assets/haru/haru.1024/texture_00.png",
        "assets/haru/haru.1024/texture_01.png",
        "assets/haru/haru.1024/texture_02.png",
    ]
};


window.onload = () => {
    let Live2DModel = new Simple(CANVAS_SIZE, CANVAS_ID, MODEL_DEF);
};


class Simple{
    /*
     * コンストラクタ
     * @param {number} canSize
     * @param {string} canId
     */
    constructor(canSize, canId, modelDef){
        // Live2Dモデルのインスタンス
        this.live2DModel = null;
        // アニメーションを停止するためのID
        this.requestID = null;
        // モデルの初期化が完了したら true
        this.initLive2DCompleted = false;
        // WebGL Image型オブジェクトの配列
        this.loadedImages = [];
        // Live2D モデル設定
        this.modelDef = modelDef;
        // Live2Dの初期化
        Live2D.init();
        // canvasオブジェクトを取得
        this.canvas = document.getElementById(canId);
        this.canvas.width = this.canvas.height = canSize;
        // コンテキストを失ったとき
        this.canvas.addEventListener("webglcontextlost", (e) => {
            console.error("context lost");
            this.initLive2DCompleted = false;
            // アニメーションを停止
            let cancelAnimationFrame =
                window.cancelAnimationFrame ||
                window.mozCancelAnimationFrame;
            cancelAnimationFrame(this.requestID);
            e.preventDefault();
        }, false);
        // コンテキストが復元されたとき
        this.canvas.addEventListener("webglcontextrestored" , (e) => {
            console.error("webglcontext restored");
            this.initLoop(this.canvas);
        }, false);
        // Init and start Loop
        this.initLoop(this.canvas);
    }

    /***
     * WebGLコンテキストを取得・初期化。
     * Live2Dの初期化、描画ループを開始。
     * @param {canvas} canvas
     */
    initLoop(canvas){
        // WebGLのコンテキストを取得する
        let para = {
            premultipliedAlpha : true,
    //        alpha : false
        };
        this.gl = this.getWebGLContext(canvas, para);
        if (!this.gl) {
            console.error("Failed to create WebGL context.");
            return;
        }
        // 拡張機能を有効化
        this.ext = this.gl.getExtension('ANGLE_instanced_arrays');
        if(this.ext == null){
            alert('ANGLE_instanced_arrays not supported');
            return;
        }
        // 描画エリアをクリア
        this.gl.clearColor( 0.0 , 0.0 , 0.0 , 0.0 );
        // OpenGLのコンテキストをセット
        Live2D.setGL(this.gl);
        // mocファイルからLive2Dモデルのインスタンスを生成
        this.loadBytes(this.modelDef.model, (buf) => {
            this.live2DModel = Live2DModelWebGL.loadModel(buf);
        });
        // テクスチャの読み込み
        let promises = [];
        for(let i = 0; i < this.modelDef.textures.length; i++){
            promises[i] = this.loadTextureImage(i);
        }
        // 全部テクスチャロードしたら次の処理へ
        Promise.all(promises).then(() => {
            // フレームバッファ用の初期化処理
            this.Init_framebuffer();
            this.tick();
        });
    }

    /***
     * テクスチャを読み込みPromiseを返します。
     * @param {Number} i
     * @returns {Promise}
     */
    loadTextureImage(i) {
        this.loadedImages[i] = new Image();
        return new Promise((resolve, reject) => {
            this.loadedImages[i].addEventListener('load', (e) => {
                resolve(this.loadedImages[i]);
            });
            this.loadedImages[i].src = this.modelDef.textures[i];
        });
    }

    /***
     * ループ処理
     */
    tick(){
        this.draw(); // 1回分描画
        let requestAnimationFrame =
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame;
            this.requestID = requestAnimationFrame(this.tick.bind(this));
    }

    /***
     * 描画処理
     */
    draw(){
        // Live2D初期化
        if( !this.live2DModel )
            return; //ロードが完了していないので何もしないで返る
        // ロード完了後に初回のみ初期化する
        if( !this.initLive2DCompleted ){
            this.initLive2DCompleted = true;
            // 画像からWebGLテクスチャを生成し、モデルに登録
            for( let i = 0; i < this.loadedImages.length; i++ ){
                //Image型オブジェクトからテクスチャを生成
                let texName = this.createTexture(this.gl, this.loadedImages[i]);
                this.live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
            }
            // テクスチャの元画像の参照をクリア
            this.loadedImages = null;

            // 表示位置を指定するための行列を定義する
            let s = 2.0 / this.live2DModel.getCanvasWidth(); //canvasの横幅を-1..1区間に収める
            let matrix4x4 = [
                s, 0, 0, 0,
                0,-s, 0, 0,
                0, 0, 1, 0,
               -1, 1, 0, 1
            ];
            this.live2DModel.setMatrix(matrix4x4);
        }

        // キャラクターのパラメータを適当に更新
        let t = UtSystem.getUserTimeMSec() * 0.001 * 2 * Math.PI; //1秒ごとに2π(1周期)増える
        let cycle = 3.0; //パラメータが一周する時間(秒)
        // PARAM_ANGLE_Xのパラメータが[cycle]秒ごとに-30から30まで変化する
        this.live2DModel.setParamFloat("PARAM_ANGLE_X", 30 * Math.sin(t/cycle));
        this.live2DModel.setParamFloat("PARAM_EYE_R_OPEN", 1 * Math.sin(t/cycle));
        this.live2DModel.setParamFloat("PARAM_EYE_L_OPEN", 1 * Math.sin(t/cycle));
        // 描画エリアをクリア
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // フレームバッファをバインドする
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbuffer.framebuffer);
        // 描画エリアをクリア
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        // ブレンディングを有効にする
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Live2Dモデルを更新して描画
        this.live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
        this.live2DModel.draw();   // 描画

        // フレームバッファのバインドを解除
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.activeTexture( this.gl.TEXTURE0 );

        // フレームバッファのテクスチャをバインド
        this.gl.bindTexture(this.gl.TEXTURE_2D, ftexture);
        // シェーダー切り替え
        this.gl.useProgram(this.off_prg);
        // 描画エリアをクリア
        this.gl.clearColor(1.0, 1.0, 1.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.Init_vbo_ibo();
        // uniform変数にテクスチャを登録
        this.gl.uniform1i(this.uniLocation[1], 0);
        // モデル座標変換行列の生成
        this.m.identity(this.mMatrix);
        // スケールさせる
        this.m.scale(this.mMatrix, [0.5, 0.5, 0.5], this.mMatrix);
        // 行列の掛け合わせ
        this.m.multiply(this.tmpMatrix, this.mMatrix, this.mvpMatrix);
        this.gl.uniformMatrix4fv(this.uniLocation[0], false, this.mvpMatrix);
        // uniform変数の登録と描画
//        this.gl.drawElements(this.gl.TRIANGLES, this.index.length, this.gl.UNSIGNED_SHORT, 0);
        // インスタンスをレンダリングするドローコール
        this.ext.drawElementsInstancedANGLE(this.gl.TRIANGLES, this.index.length, this.gl.UNSIGNED_SHORT, 0, this.instanceCount);
    }

    /***
     * WebGLのコンテキストを取得する
     * @param {canvas} canvas
     */
    getWebGLContext(canvas){
        let NAMES = [ "webgl" , "experimental-webgl" , "webkit-3d" , "moz-webgl"];
        let param = {
            alpha : true,
            premultipliedAlpha : true
        };

        for( let i = 0; i < NAMES.length; i++ ){
            try{
                let ctx = canvas.getContext( NAMES[i], param );
                if( ctx ) return ctx;
            }
            catch(e){}
        }
        return null;
    }

    /***
     * Image型オブジェクトからテクスチャを生成
     * @param {gl} gl
     * @param {Image} image
     * @returns {Texture}
     */
    createTexture(gl, image){
        let texture = gl.createTexture(); //テクスチャオブジェクトを作成する
        if ( !texture ){
            console.error("Failed to generate gl texture name.");
            return -1;
        }

        if(this.live2DModel.isPremultipliedAlpha() == false){
            // 乗算済アルファテクスチャ以外の場合
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);	//imageを上下反転
        gl.activeTexture( gl.TEXTURE0 );
        gl.bindTexture( gl.TEXTURE_2D, texture );
        gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture( gl.TEXTURE_2D, null );

        return texture;
    }

    /***
     * ファイルをバイト配列としてロードする
     * @param {string} path
     * @param {callback} callback
     */
    loadBytes(path, callback){
        let request = new XMLHttpRequest();
        request.open("GET", path , true);
        request.responseType = "arraybuffer";
        request.onload = () => {
            switch( request.status ){
            case 200:
                callback( request.response );
                break;
            default:
                console.error( "Failed to load (" + request.status + ") : " + path );
                break;
            }
        }
        request.send(null);
    }

    /***
     * フレームバッファの初期化処理
     */
    Init_framebuffer(){
        // 頂点シェーダとフラグメントシェーダの生成
        let off_v_shader = this.create_shader('vs');
        let off_f_shader = this.create_shader('fs');
        // プログラムオブジェクトの生成とリンク
        this.off_prg = this.create_program(off_v_shader, off_f_shader);
        // 深度テストを有効にする
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        // ブレンディングを有効にする
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.clearDepth(1.0);
        // フレームバッファを生成
        this.fbuffer = this.create_framebuffer(CANVAS_SIZE, CANVAS_SIZE);

        // attributeLocationを配列に取得
        this.attLocation = new Array();
        this.attLocation[0] = this.gl.getAttribLocation(this.off_prg, 'position');
        this.attLocation[1] = this.gl.getAttribLocation(this.off_prg, 'color');
        this.attLocation[2] = this.gl.getAttribLocation(this.off_prg, 'textureCoord');
        this.attLocation[3] = this.gl.getAttribLocation(this.off_prg, 'instancePosition');
        // attributeの要素数を配列に格納
        this.attStride = new Array();
        this.attStride[0] = 3;
        this.attStride[1] = 4;
        this.attStride[2] = 2;
        this.attStride[3] = 3;

        // 頂点の位置
        this.position = [
            -1.0,  1.0,  0.0,
             1.0,  1.0,  0.0,
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0
        ];
        // 頂点色
        this.color = [
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 1.0
        ];
        // テクスチャ座標
        this.textureCoord = [
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ];
        // 頂点インデックス
        this.index = [
            0, 1, 2,
            3, 2, 1
        ];
        // VBOとIBOの生成
        let vPosition     = this.create_vbo(this.position);
        let vColor        = this.create_vbo(this.color);
        let vTextureCoord = this.create_vbo(this.textureCoord);
        this.VBOList       = [vPosition, vColor, vTextureCoord];
        this.iIndex        = this.create_ibo(this.index);

        // インスタンスの数
	this.instanceCount = 40;
	// インスタンス用配列
	let instancePositions = new Array();
	// 配列用のストライド
	const offsetPosition = 3;
 	// ループしながらインスタンス用データを配列に格納
	for(let i = 0; i < this.instanceCount; i++){
            // ランダムで0.0〜2.0の値取得
            let ranX = Math.floor(Math.random() * 2 * 10)/ 10;
            let ranY = Math.floor(Math.random() * 2 * 10)/ 10;
            // ランダムで+か-にする
            let posX = Math.floor(Math.random() * 2)? -ranX: ranX;
            let posY = Math.floor(Math.random() * 2)? -ranY: ranY;
            // 算出した座標をセットする
            instancePositions[i * offsetPosition]     = posX;
            instancePositions[i * offsetPosition + 1] = posY;
            instancePositions[i * offsetPosition + 2] = 0.0;
//            instancePositions[i * offsetPosition]     = 1.0;
//            instancePositions[i * offsetPosition + 1] = 0.0;
//            instancePositions[i * offsetPosition + 2] = 0.0;
	}
	// 配列からVBOを生成
	let inpos_vbo = this.create_vbo(instancePositions);
	// インスタンス用の座標位置VBOを有効にする
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, inpos_vbo);
	this.gl.enableVertexAttribArray(this.attLocation[3]);
	this.gl.vertexAttribPointer(this.attLocation[3], this.attStride[3], this.gl.FLOAT, false, 0, 0);
	// インスタンスを有効化し除数を指定する
	this.ext.vertexAttribDivisorANGLE(this.attLocation[3], 1);

        // uniformLocationを配列に取得
        this.uniLocation = new Array();
        this.uniLocation[0]  = this.gl.getUniformLocation(this.off_prg, 'mvpMatrix');
        this.uniLocation[1]  = this.gl.getUniformLocation(this.off_prg, 'texture');

        // 各種行列の生成と初期化
        this.m = new matIV();
        this.mMatrix   = this.m.identity(this.m.create());
        this.vMatrix   = this.m.identity(this.m.create());
        this.pMatrix   = this.m.identity(this.m.create());
        this.tmpMatrix = this.m.identity(this.m.create());
        this.mvpMatrix = this.m.identity(this.m.create());
    }

    /***
     * vboとibo初期化処理
     */
    Init_vbo_ibo(){
        // VBOとIBOの登録
        this.set_attribute(this.VBOList, this.attLocation, this.attStride);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iIndex);

        // ビュー×プロジェクション座標変換行列
        this.m.lookAt([0.0, 0.0, 2.4], [0, 0, 0], [0, 1, 0], this.vMatrix);
        this.m.perspective(45, CANVAS_SIZE / CANVAS_SIZE, 0.1, 100, this.pMatrix);
        this.m.multiply(this.pMatrix, this.vMatrix, this.tmpMatrix);
    }

    /***
     * シェーダーコンパイル
     * @param {string} id
     */
    create_shader(id){
        // シェーダを格納する変数
        let shader;
        // HTMLからscriptタグへの参照を取得
        let scriptElement = document.getElementById(id);
        // scriptタグが存在しない場合は抜ける
        if(!scriptElement){return;}
        // scriptタグのtype属性をチェック
        switch(scriptElement.type){
            // 頂点シェーダの場合
            case 'x-shader/x-vertex':
                shader = this.gl.createShader(this.gl.VERTEX_SHADER);
                break;
            // フラグメントシェーダの場合
            case 'x-shader/x-fragment':
                shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
                break;
            default :
                return;
        }
        // 生成されたシェーダにソースを割り当てる
        this.gl.shaderSource(shader, scriptElement.text);
        // シェーダをコンパイルする
        this.gl.compileShader(shader);
        // シェーダが正しくコンパイルされたかチェック
        if(this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)){
            // 成功していたらシェーダを返して終了
            return shader;
        }else{
            // 失敗していたらエラーログをアラートする
            alert(this.gl.getShaderInfoLog(shader));
        }
    }

    /***
     * プログラムオブジェクトを生成しシェーダをリンクする関数
     * @param {vertexshader} vs
     * @param {pixelshader} fs
     * @returns {Array|program}
     */
    create_program(vs, fs){
        // プログラムオブジェクトの生成
        let program = this.gl.createProgram();
        // プログラムオブジェクトにシェーダを割り当てる
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        // シェーダをリンク
        this.gl.linkProgram(program);
        // シェーダのリンクが正しく行なわれたかチェック
        if(this.gl.getProgramParameter(program, this.gl.LINK_STATUS)){
            // 成功していたらプログラムオブジェクトを有効にする
            this.gl.useProgram(program);
            // プログラムオブジェクトを返して終了
            return program;
        }else{
            // 失敗していたらエラーログをアラートする
            alert(this.gl.getProgramInfoLog(program));
        }
    }

    /***
     * VBOを生成する関数
     * @param {Float32Array} data
     * @returns {vbo}
     */
    create_vbo(data){
        // バッファオブジェクトの生成
        let vbo = this.gl.createBuffer();
        // バッファをバインドする
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        // バッファにデータをセット
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
        // バッファのバインドを無効化
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        // 生成した VBO を返して終了
        return vbo;
    }

    /***
     * VBOをバインドし登録する関数
     * @param {vertexBufferObject} vbo
     * @param {AttribLocation} attL
     * @param {Array} attS
     */
    set_attribute(vbo, attL, attS){
        // 引数として受け取った配列を処理する
        for(let i in vbo){
            // バッファをバインドする
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo[i]);
            // attributeLocationを有効にする
            this.gl.enableVertexAttribArray(attL[i]);
            // attributeLocationを通知し登録する
            this.gl.vertexAttribPointer(attL[i], attS[i], this.gl.FLOAT, false, 0, 0);
        }
    }

    /***
     * IBOを生成する関数
     * @param {ibo} data
     * @returns {ibo}
     */
    create_ibo(data){
        // バッファオブジェクトの生成
        let ibo = this.gl.createBuffer();
        // バッファをバインドする
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);
        // バッファにデータをセット
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), this.gl.STATIC_DRAW);
        // バッファのバインドを無効化
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
        // 生成したIBOを返して終了
        return ibo;
    }

    /***
     * フレームバッファを生成する
     * @param {number} width
     * @param {number} height
     * @returns {framebuffer, depthrenderbuffer}
     */
    create_framebuffer(width, height){
        // フレームバッファオブジェクトの生成
        let framebuffer = this.gl.createFramebuffer();
        // フレームバッファをバインドする
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        // レンダーバッファオブジェクトの生成
        let depthrenderbuffer = this.gl.createRenderbuffer();
        // レンダーバッファをバインドする
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthrenderbuffer);
        // レンダーバッファのフォーマット設定
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);
        // フレームバッファへの深度バッファの関連付ける
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, depthrenderbuffer);

        // テクスチャオブジェクトの生成
        let frametexture = this.gl.createTexture();
        // テクスチャをバインドする
        this.gl.bindTexture(this.gl.TEXTURE_2D, frametexture);
        // テクスチャへイメージを適用
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        // テクスチャパラメーター
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        // フレームバッファにテクスチャを関連付ける
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, frametexture, 0);
        // テクスチャのバインドを無効化
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        // レンダーバッファのバインドを無効化
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
        // フレームバッファのバインドを無効化
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        // 生成したテクスチャをグローバル変数に代入
        ftexture = frametexture;
        // 返り値
        return {framebuffer: framebuffer, depthrenderbuffer: depthrenderbuffer, texture:ftexture};
    }
};