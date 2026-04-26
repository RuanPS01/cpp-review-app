#include <iostream>

using namespace std;

int main()
{
    float x[100];
    int i = 0;
    float y;
    float posicao = -1;
    
    cin >> x[i];
    
    while (x[i] != 0) {
        i++;
        
        cin >> x[i];
    }
    
    cin >> y;
    
    for (int j = 0; j < i; j++) {
        if (y == x[j]) {
            posicao = j;
            
            break;
        }
    }
    
    if (posicao != -1) {
        cout << y << " encontrado na posicao " << posicao << endl;
    }else {
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}