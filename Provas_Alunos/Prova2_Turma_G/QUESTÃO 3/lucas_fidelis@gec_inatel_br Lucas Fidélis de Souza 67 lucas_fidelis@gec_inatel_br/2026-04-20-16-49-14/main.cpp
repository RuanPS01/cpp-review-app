#include <iostream>
#include <iomanip>

using namespace std ;

int main(){
    int n ; //para igualar a variavel criada para o while 
    int i ; //contador do for 
    int valores[100]; //vetor
    int valor ;//para condicao de parada do while 
    int tamanho=0 ; //para condicao de parada 
    double media ;
    double soma=0 ; //para fazer som+=
    int quant=0; //para contar a quantos valores existem e assim fazer a media
    int maior_tempo ; //para fazer a condicao do maior
    
    //fazendo while 
    while(true){
        cin >> valor;
        //fazendo condicao 
        if(valor==0){
            break ;
        }
        valores[tamanho]= valor ;
        tamanho ++;
    }
    n=tamanho;
    for(i=0; i<n; i++){
        //testando condicao do maior 
        if(valores[i]>maior_tempo){
            maior_tempo=valores[i];
        }
        //contando quantidade de valores para calculo da media 
        quant ++ ; 
        
        //somando para media
        soma+=valores[i];
    }
    //calculando media 
    media=soma/quant;
    cout << fixed << setprecision(2);
    cout << "Maior tempo: " << maior_tempo << " minutos" << endl ;
    cout << "Media dos tempos: " << media << " minutos" <<  endl ;
    
    return 0 ;
}