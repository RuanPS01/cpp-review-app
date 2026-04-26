#include <iostream>

using namespace std ;

int main(){
    int i; // contador do for 
    double valor ;// para o while 
    double valores[1000] ; //vetor 
    int tamanho =0 ; //para o while 
    double x ; //valor q desejo procurar 
    int posi=0; //para igualar a i e encontrar a posicao, posi=i
    
    //fazendo while
    while(true){
        cin >> valor ;
        if(valor==0){
            break ;
        }
        valores[tamanho]=valor ;
        tamanho++ ;
    }
    //entrando com valor q desejo procurar
    cin >> x ;
    
    //declarando "bool procurado" para encontrar este valor 
    bool procurado= false ;
    for(i=0; i<tamanho; i++){
        //testand condicao 
        if(valores[i]==x){
            procurado=true;
            posi=i;
           
            cout << x << " encontrado na posicao " << posi << endl ;
            
        }
      
    }
    if(!procurado){
        cout << "Elemento nao encontrado" << endl ;
    }
    return 0 ;
}
//sem o break ele fica falando a posicao de numeros iguais 
// exemplo: 4.2 4.2 4.2, o codigo mostra a posicao de cada um desses numeros iguais 
//exemplo: 4.2 encontrado na ppsicao 0, 4.2 encontrado na posicao 1...
// com o break da errado porem fica 18/17 tests passed 