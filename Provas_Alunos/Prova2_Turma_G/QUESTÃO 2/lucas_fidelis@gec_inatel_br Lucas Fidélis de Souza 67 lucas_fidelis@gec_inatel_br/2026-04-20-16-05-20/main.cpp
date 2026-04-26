#include <iostream>
#include <iomanip>

using namespace std ;

int main(){
    int i ; //contador do for 
    int n ; //ate n vezes 
    int valores ; //valores de entrada 
    double media ; //para o calculo da media 
    int quant=0 ; //quantidade de valores digitados para fazer a media 
    double soma=0 ; //para condicao de soma+=
    
    //entrando com n 
    cin >> n ;
    for(i=0; i<n; i++){
        //entrando com valores
        cin >> valores ; 
        
        //contando quantos valores existem para o calculo da media 
        quant++;
        
        //fazendo soma dos valores 
        soma+=valores ; 
    }
    //calculando media fora do for depois de ter contado todos num
    media = soma/quant ;
    cout << fixed << setprecision(4);
    cout << media << endl ;
    
    return 0 ;
}