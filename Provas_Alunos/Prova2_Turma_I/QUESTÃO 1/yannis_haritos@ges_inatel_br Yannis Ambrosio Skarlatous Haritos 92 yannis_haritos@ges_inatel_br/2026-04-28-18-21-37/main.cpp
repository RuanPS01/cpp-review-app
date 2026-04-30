#include<iostream>

using namespace std;
int main(){
    
    int N;
    int x;
    int divisivel = 0;
    
    cin >> N;
    // o codigo esta dando problema na saida, nos testes esta dizendo que ha mais numeros divisiveis por tres sendo que nao ha.
    // exemplo: na minha saida mostra 1 numero que e divisivel e na saida do programa mostra a mais sendo que nao tem outro que seja divisivel.
    for( int i = 0; i < N; i++){
        cin >> x;
        if( x >= 3 || x <= -3){
            if( x % 3 == 0){
                divisivel++;
            }
        }    
    }
    
    cout << divisivel << endl;

    return 0;
}